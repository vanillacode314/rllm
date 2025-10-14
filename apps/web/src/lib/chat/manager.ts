import { debounce } from '@tanstack/solid-pacer';
import { type } from 'arktype';
import { modifyMutable, produce, reconcile, unwrap } from 'solid-js/store';
import { Option } from 'ts-result-option';

import type { $ResultFetcher } from '~/lib/adapters/types';
import type { MCPClient } from '~/lib/mcp/client';
import type { TAttachment, TChat, TMessage } from '~/types/chat';

import { ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT } from '~/constants/prompts';
import { openAiAdapter } from '~/lib/adapters/openai';
import { fetchers } from '~/queries';
import { finalizeChat } from '~/routes/chat/-utils';
import { getMessagesForPath } from '~/utils/chat';
import { ReactiveTreeNode } from '~/utils/tree';
import { ragWorkerPool } from '~/workers/rag';

export class ChatGenerationManager {
	static chats = new Map<string, { chat: TChat; controller: AbortController }>();
	static abortChat(id: string): void {
		this.chats.get(id)?.controller.abort();
	}
	static getChat(id: string): TChat | undefined {
		return this.chats.get(id)?.chat;
	}
	static isAborted(id: string): boolean {
		return this.chats.get(id)?.controller.signal.aborted ?? false;
	}
	static removeChat(id: string) {
		this.chats.delete(id);
	}

	static async startGeneration(
		id: string,
		chat: TChat,
		path: number[],
		mcpClients: MCPClient[],
		attachments: TAttachment[],
		fetcher: $ResultFetcher
	): Promise<{
		controller: AbortController;
		newChat: TChat;
		newPath: number[];
		promise: Promise<unknown>;
	}> {
		const controller = new AbortController();
		const node = chat.messages.traverse(path).expect('should be able to traverse to node');
		const provider = await fetchers.providers.byId(chat.settings.providerId);
		if (!provider) throw new Error('');
		const message = {
			type: 'llm',
			model: chat.settings.model,
			provider: provider.name,
			chunks: [],
			finished: false
		} satisfies TMessage;
		node.addChild(new ReactiveTreeNode(message));
		const newChat = produce((chat: TChat) => {
			chat.finished = false;
		})(chat);
		const newPath = [...path, node.children.length - 1];
		const messages = getMessagesForPath(newPath, chat.messages).unwrap();

		let tools = await Option.from(mcpClients)
			.map((clients) =>
				Promise.all(
					clients
						.values()
						.filter((client) => client.status === 'connected')
						.map((client) => client.listTools())
				).then((value) => value.flat())
			)
			.transposePromise();

		if (attachments.length > 0) {
			const tool = {
				name: 'retrieve_from_attachments',
				schema: type({
					query: type('string'),
					postSearchFilters: {
						limit: type('number.integer > 0'),
						offset: type('number.integer >= 0')
					},
					preSearchFilters: {
						'afterIndex?': type('number.integer >= 0'),
						'beforeIndex?': type('number.integer >= 0')
					}
				}),
				description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
					attachments.map((attachement) => attachement.description)
				),
				handler: async (args: {
					postSearchFilters: {
						limit: number;
						offset: number;
					};
					preSearchFilters: {
						afterIndex?: number;
						beforeIndex?: number;
					};
					query: string;
				}) => {
					const { query } = args;
					const { limit, offset } = args.postSearchFilters;
					const { afterIndex, beforeIndex } = args.preSearchFilters;
					if (afterIndex !== undefined && beforeIndex !== undefined && afterIndex > beforeIndex) {
						throw new Error('afterIndex must be less than beforeIndex');
					}
					const worker = await ragWorkerPool.get();
					const embedding = await worker.getEmbedding(query);
					const documents = await Promise.all(
						attachments
							.values()
							.flatMap((attachment) =>
								attachment.documents.map((document) => ({
									...document,
									attachment
								}))
							)
							.filter((document) => {
								if (afterIndex !== undefined && document.index < afterIndex) return false;
								if (beforeIndex !== undefined && document.index > beforeIndex) return false;
								return true;
							})
							.map(async (document) => ({
								...document,
								similarity: await worker.cosineSimilarity(embedding, unwrap(document.embeddings))
							}))
					);
					documents.sort((a, b) => b.similarity - a.similarity);

					return JSON.stringify(
						documents.slice(offset, offset + limit).map((document) => ({
							index: document.index,
							description: document.attachment.description,
							content: document.content
						})),
						null,
						2
					);
				}
			};
			tools = Option.Some(
				tools.mapOr([tool], (tools) => {
					tools.push(tool);
					return tools;
				})
			);
		}

		const promise = openAiAdapter
			.handleChatCompletion({
				messages,
				fetcher,
				model: chat.settings.model,
				tools,
				onChunk: Option.Some(
					debounce(
						async (chunks) => {
							if (chunks.length === 0) return;
							modifyMutable(message.chunks, reconcile(chunks));
						},
						{ wait: 5 }
					)
				),
				onAbort: Option.Some(() => finalizeChat(chat, path)),
				signal: Option.Some(controller.signal)
			})
			.match(
				() => {},
				(error) => {
					if (controller.signal.aborted) return;
					throw error;
				}
			);
		this.chats.set(id, { chat, controller });
		return { newChat, newPath, controller, promise };
	}
}
