import type { Accessor } from 'solid-js';

import { debounce } from '@tanstack/solid-pacer';
import { createMemo, from } from 'solid-js';
import { unwrap } from 'solid-js/store';
import { Option } from 'ts-result-option';
import * as z from 'zod/mini';

import type { TAttachment, TChat, TMessage } from '~/types/chat';

import {
  type TFeedbackQuestion,
  useFeedbackModal
} from '~/components/modals/auto-import/FeedbackModal';
import {
  ASK_QUESTIONS_TOOL_PROMPT,
  ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT
} from '~/constants/prompts';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { MCPManager } from '~/lib/mcp/manager';
import { fetchers } from '~/queries';
import { finalizeChat } from '~/routes/chat/-utils';
import { getMessagesForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { Tree, TreeNode } from '~/utils/tree';
import { ragWorkerPool } from '~/workers/rag';

import { handleCompletion } from '.';
import { makeTool } from './utils';

export class ChatGenerationManager {
  private static chats = new Map<
    string,
    { chat: TChat; controller: AbortController; done: boolean; path: number[] }
  >();
  private static pendingSubscribers = new Map<string, Set<(isPending: boolean) => void>>();
  private static subscribers = new Map<string, Set<(chat: TChat, path: number[]) => void>>();

  static abortChat(id: string): void {
    this.chats.get(id)?.controller.abort();
    this.removeChat(id);
  }

  static createIsPending(id: Accessor<string>): Accessor<boolean> {
    const idMemo = createMemo(id);
    const s = createMemo(() => {
      const $id = idMemo();
      return from<boolean>((set) => {
        return this.onPendingChange($id, set);
      }, ChatGenerationManager.isPending($id));
    });
    return () => s()();
  }
  static getChat(id: string): TChat | undefined {
    return this.chats.get(id)?.chat;
  }
  static isAborted(id: string): boolean {
    return this.chats.get(id)?.controller.signal.aborted ?? false;
  }
  static isPending(id: string): boolean {
    return this.chats.has(id);
  }
  static onPendingChange(id: string, handler: (isPending: boolean) => void) {
    const subscribers = this.pendingSubscribers.get(id) ?? new Set();
    subscribers.add(handler);
    this.pendingSubscribers.set(id, subscribers);
    return () => {
      subscribers.delete(handler);
    };
  }
  static removeChat(id: string) {
    this.chats.delete(id);
    this.emitPendingUpdate(id);
  }

  static async startGeneration(
    id: string,
    path: number[],
    attachments: TAttachment[],
    feedbackEnabled: boolean = false
  ): Promise<{
    chat: TChat;
    controller: AbortController;
    newPath: number[];
    promise: Promise<unknown>;
  }> {
    const controller = new AbortController();
    const chat = await fetchers.chats.byId(id).then((chat) => ({
      ...chat,
      messages: Tree.fromJSON(chat.messages)
    }));
    const node = chat.messages
      .traverse(path)
      .expect(`should be able to traverse to node at ${JSON.stringify(path)}`);
    const provider = await fetchers.providers.byId(chat.settings.providerId);
    if (!provider) throw new Error(`Provider (${chat.settings.providerId}) not found`);
    const adapter = new OpenAIAdapter(provider.baseUrl, provider.token);

    let tools = await MCPManager.getAllTools().then((mcpTools) =>
      mcpTools.length > 0 ? Option.Some(mcpTools) : Option.None()
    );

    const message = {
      type: 'llm',
      model: chat.settings.modelId,
      provider: provider.name,
      chunks: [],
      finished: false
    } satisfies TMessage;
    node.addChild(new TreeNode(message));
    chat.finished = false;
    const newPath = [...path, node.children.length - 1];
    this.emitUpdate(id);
    const messages = getMessagesForPath(newPath, chat.messages).unwrap();

    if (attachments.length > 0) {
      const tool = makeTool({
        name: 'retrieve_from_attachments',
        inputSchema: z.object({
          query: z.string().check(z.minLength(1)),
          postSearchFilters: z.object({
            limit: z.number().check(z.int(), z.gt(0)),
            offset: z.number().check(z.int(), z.gte(0))
          }),
          preSearchFilters: z.optional(
            z.object({
              afterIndex: z.optional(z.number().check(z.int(), z.gt(0))),
              beforeIndex: z.optional(z.number().check(z.int(), z.gt(0)))
            })
          )
        }),
        description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
          attachments.map((attachement) => attachement.description)
        ),
        handler: async (args: {
          postSearchFilters: {
            limit: number;
            offset: number;
          };
          preSearchFilters?: {
            afterIndex?: number;
            beforeIndex?: number;
          };
          query: string;
        }) => {
          const { query } = args;
          const { limit, offset } = args.postSearchFilters;
          const { afterIndex, beforeIndex } = args.preSearchFilters ?? {};
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
      });
      tools = Option.Some(
        tools.mapOr([tool], (tools) => {
          tools.push(tool);
          return tools;
        })
      );
    }
    if (feedbackEnabled) {
      const feedbackModal = useFeedbackModal();
      const feedbackTool = makeTool({
        name: 'ask_questions',
        inputSchema: z.object({
          questions: z
            .array(
              z
                .object({
                  id: z.string(),
                  options: z.optional(z.array(z.string())),
                  placeholder: z.optional(z.string()),
                  question: z.string(),
                  type: z.union([z.literal('radio'), z.literal('checkbox'), z.literal('textarea')])
                })
                .check(
                  z.refine(
                    (value) =>
                      !(
                        ['checkbox', 'radio'].includes(value.type) &&
                        (value.options === undefined || value.options.length < 2)
                      ),
                    {
                      error: 'Checkbox or radio questions must have at least 2 options'
                    }
                  )
                )
            )
            .check(z.minLength(1))
        }),
        description: ASK_QUESTIONS_TOOL_PROMPT,
        handler: async (args: { questions: TFeedbackQuestion[] }) => {
          const { questions } = args;
          for (const question of questions) {
            if (question.options === undefined) continue;
            for (let i = question.options.length - 1, j = 0; i >= 0; i--, j++) {
              if (question.options[i].trim().toLowerCase() === 'other')
                question.options.splice(i, 1);
            }
          }
          const responses = await feedbackModal.open(questions);
          if (responses) {
            return JSON.stringify({ success: true, responses });
          }
          return JSON.stringify({ success: false, message: 'Cancelled by user' });
        }
      });
      tools = Option.Some(
        tools.mapOr([feedbackTool], (tools) => {
          tools.push(feedbackTool);
          return tools;
        })
      );
    }

    const $chat = this.addChat(id, chat, controller, newPath);
    const prompts = [] as string[];
    if (chat.settings.includeDateTimeInSystemPrompt)
      prompts.push(`Current date and time: ${this.formatCurrentDateTime()}`);
    if (chat.settings.systemPrompt) prompts.push(chat.settings.systemPrompt);
    const system = prompts.join('\n\n');

    const promise = handleCompletion({
      system,
      messages,
      adapter,
      model: chat.settings.modelId,
      tools: tools.toUndefined(),
      reasoningEffort: chat.settings.reasoning,
      onChunk: debounce(
        async (chunks) => {
          if (chunks.length === 0) return;
          Object.assign(message.chunks, chunks);
          this.emitUpdate(id);
          if ($chat.done) this.removeChat(id);
        },
        { wait: 16 }
      ),
      onAbort: () => finalizeChat(chat, newPath),
      signal: controller.signal
    })
      .match(
        () => {
          finalizeChat(chat, newPath);
        },
        (error) => {
          if (controller.signal.aborted) return;
          finalizeChat(chat, newPath, formatError(error));
          console.error(error);
        }
      )
      .finally(() => {
        this.emitUpdate(id);
        $chat.done = true;
      });
    return { newPath, chat, controller, promise };
  }

  static subscribe(id: string, handler: (chat: TChat, path: number[]) => void) {
    const subscribers = this.subscribers.get(id) ?? new Set();
    subscribers.add(handler);
    this.subscribers.set(id, subscribers);
    return () => {
      subscribers.delete(handler);
    };
  }

  private static addChat(id: string, chat: TChat, controller: AbortController, path: number[]) {
    const $chat = { chat, controller, path, done: false };
    this.chats.set(id, $chat);
    this.emitPendingUpdate(id);
    return $chat;
  }

  private static emitPendingUpdate(id: string) {
    for (const subscriber of this.pendingSubscribers.get(id) ?? []) {
      subscriber(this.isPending(id));
    }
  }

  private static emitUpdate(id: string) {
    document.dispatchEvent(new CustomEvent('chat:updated:noscroll'));
    const chat = this.chats.get(id);
    if (!chat) {
      console.warn(`Chat ${id} not found`);
      return;
    }
    for (const subscriber of this.subscribers.get(id) ?? []) {
      subscriber(chat.chat, chat.path);
    }
  }

  private static formatCurrentDateTime(): string {
    return new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
  }
}
