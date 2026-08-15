import type { Accessor } from 'solid-js';

import { Debouncer } from '@tanstack/solid-pacer';
import { createMemo, from } from 'solid-js';
import { Option } from 'ts-result-option';
import * as z from 'zod/mini';

import type { TProvider } from '~/db/app-schema';
import type { TAttachment, TChat, TMessage } from '~/types/chat';

import { useFeedbackModal } from '~/components/modals/auto-import/FeedbackModal';
import {
  ASK_QUESTIONS_TOOL_PROMPT,
  ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT,
  HANDOFF_TOOL_INSTRUCTIONS_PROMPT,
  MATH_SYSTEM_PROMPT,
  WEB_SEARCH_SYSTEM_PROMPT
} from '~/constants/prompts';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { MCPManager } from '~/lib/mcp/manager';
import { vectorDb } from '~/lib/vector-db/client';
import { transientDb } from '~/lib/vector-db/transient';
import { fetchers } from '~/queries';
import { finalizeChat } from '~/routes/(chat)/-utils';
import { getMessagesForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { Tree, TreeNode } from '~/utils/tree';

import type { ChatGenerationStorage } from './storages';

import { handleCompletion } from '..';
import { makeTool } from '../utils';

export class ChatGenerationManager {
  private static chats = new Map<
    string,
    { chat: TChat; controller: AbortController; path: number[] }
  >();
  private static pendingSubscribers = new Map<string, Set<(isPending: boolean) => void>>();
  private static storages = [] as ChatGenerationStorage[];
  private static subscribers = new Map<string, Set<(chat: TChat, path: number[]) => void>>();

  static abortChat(id: string): void {
    const $chat = this.chats.get(id);
    if (!$chat) return;
    $chat?.controller.abort();
    finalizeChat($chat.chat, $chat.path);
  }

  static createIsPending(id: Accessor<string>): Accessor<boolean> {
    const idMemo = createMemo(id);
    const s = createMemo(() => {
      const $id = idMemo();
      return from<boolean>((set) => this.onPendingChange($id, set), this.isPending($id));
    });
    return () => s()();
  }
  static getChat(id: string): TChat | undefined {
    return this.chats.get(id)?.chat;
  }
  static async getChatFromStorage(
    id: string
  ): Promise<Option<{ chat: TChat; provider: TProvider }>> {
    let chat = Option.None<TChat>();
    let provider = Option.None<TProvider>();
    for (const storage of this.storages) {
      // oxlint-disable-next-line no-await-in-loop
      let jsonChat;
      ({ chat: jsonChat, provider } = await storage.getChat(id));
      if (jsonChat.isSome()) {
        chat = jsonChat.map((c) => ({ ...c, messages: Tree.fromJSON(c.messages) }));
        break;
      }
    }
    if (chat.and(provider).isNone()) return Option.None();
    return Option.Some({ chat: chat.unwrap(), provider: provider.unwrap() });
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
  static registerStorage(storage: ChatGenerationStorage) {
    this.storages.push(storage);
  }

  static removeChat(id: string) {
    if (!this.chats.has(id)) return;
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
    promise: Promise<void>;
  }> {
    const controller = new AbortController();
    const { chat, provider } = (await this.getChatFromStorage(id)).expect(
      `Chat ${id} not found in storage`
    );
    const node = chat.messages
      .traverse(path)
      .expect(`should be able to traverse to node at ${JSON.stringify(path)}`);
    const adapter = new OpenAIAdapter(provider.baseUrl, provider.token);

    let tools = await MCPManager.getAllTools().then((mcpTools) =>
      mcpTools.length > 0 ? Option.Some(mcpTools) : Option.None()
    );

    const message: TMessage = {
      chunks: [],
      finished: false,
      model: chat.settings.modelId,
      provider: provider.name,
      type: 'llm'
    };
    node.addChild(new TreeNode(message));
    chat.finished = false;
    const newPath = [...path, node.children.length - 1];
    this.emitUpdate(id);
    const messages = getMessagesForPath(newPath, chat.messages).unwrap();

    const attachmentsByTransientStatus = {
      library: new Set(
        attachments.filter((attachment) => !attachment.transient).map((attachment) => attachment.id)
      ),
      transient: new Set(
        attachments.filter((attachment) => attachment.transient).map((attachment) => attachment.id)
      )
    };
    if (attachments.length > 0) {
      const tool = makeTool({
        description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
          attachments.map((attachement) => `${attachement.id}: ${attachement.description}`)
        ),
        handler: async (args) => {
          const { query } = args;
          const { limit, offset } = args.postSearchFilters;
          const { afterIndex, beforeIndex } = args.preSearchFilters ?? {};
          if (afterIndex !== undefined && beforeIndex !== undefined && afterIndex > beforeIndex) {
            throw new Error('afterIndex must be less than beforeIndex');
          }
          if (!attachments.some((attachment) => args.ids.includes(attachment.id))) {
            throw new Error(
              `Attachment with id (${args.ids.join(',')}) not found in the provided attachments`
            );
          }
          const results = (
            await Promise.all([
              await transientDb.query(query, {
                afterIndex,
                beforeIndex,
                documentIds: args.ids.filter((id) =>
                  attachmentsByTransientStatus.transient.has(id)
                ),
                limit: offset + limit
              }),
              await vectorDb.query(query, {
                afterIndex,
                beforeIndex,
                documentIds: args.ids.filter((id) => attachmentsByTransientStatus.library.has(id)),
                limit: offset + limit
              })
            ])
          )
            .flat()
            .filter((value) => value !== undefined);
          results.sort((a, b) => a.similarity - b.similarity);
          return JSON.stringify(
            results
              .slice(offset, offset + limit)
              .filter((result) => {
                if (afterIndex !== undefined && result.index < afterIndex) return false;
                if (beforeIndex !== undefined && result.index > beforeIndex) return false;
                return true;
              })
              .slice(offset, offset + limit)
              .map((result) => ({
                content: result.text,
                documentId: result.document_id,
                id: result.id,
                index: result.index
              })),
            null,
            2
          );
        },
        inputSchema: z.object({
          ids: z.array(z.string()).check(z.minLength(1)),
          postSearchFilters: z.object({
            limit: z.number().check(z.int(), z.gt(0)),
            offset: z.number().check(z.int(), z.gte(0))
          }),
          preSearchFilters: z.optional(
            z.object({
              afterIndex: z.optional(z.number().check(z.int(), z.gt(0))),
              beforeIndex: z.optional(z.number().check(z.int(), z.gt(0)))
            })
          ),
          query: z.string().check(z.minLength(1))
        }),
        name: 'retrieve_from_attachments'
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
        description: ASK_QUESTIONS_TOOL_PROMPT,
        handler: async (args) => {
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
            return JSON.stringify({ responses, success: true });
          }
          return JSON.stringify({ message: 'Cancelled by user', success: false });
        },
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
        name: 'ask_questions'
      });
      tools = Option.Some(
        tools.mapOr([feedbackTool], (tools) => {
          tools.push(feedbackTool);
          return tools;
        })
      );
    }

    function isHandoffMode() {
      const lastUserMsg = messages
        .filter((m): m is TMessage & { type: 'user' } => m.type === 'user')
        .at(-1);
      return (
        lastUserMsg?.chunks
          .find((c) => c.type === 'text')
          ?.content.trim()
          .startsWith('/handoff ') ?? false
      );
    }

    if (isHandoffMode()) {
      const handoffTool = makeTool({
        description: HANDOFF_TOOL_INSTRUCTIONS_PROMPT,
        handler: (args) => {
          document.dispatchEvent(new CustomEvent('chat:handoff', { detail: args }));
          return JSON.stringify({ success: true });
        },
        inputSchema: z.object({
          prefilledPrompt: z.string().check(z.minLength(1))
        }),
        name: 'handoff_to_new_chat'
      });
      tools = Option.Some(
        tools.mapOr([handoffTool], (tools) => {
          tools.push(handoffTool);
          return tools;
        })
      );
    }

    this.addChat(id, chat, controller, newPath);
    const prompts = [MATH_SYSTEM_PROMPT] as string[];
    if (chat.settings.includeDateTimeInSystemPrompt)
      prompts.push(`Current date and time: ${this.formatCurrentDateTime()}`);
    if (chat.settings.systemPrompt) prompts.push(chat.settings.systemPrompt);
    const webSearchMcpId = await fetchers.userMetadata.byId(USER_METADATA_KEYS.WEB_SEARCH_MCP_ID);
    if (webSearchMcpId && MCPManager.getClient(webSearchMcpId)?.status === 'connected') {
      prompts.push(WEB_SEARCH_SYSTEM_PROMPT);
    }
    const system = prompts.join('\n\n');

    const debouncedOnUpdate = new Debouncer(
      async ({ chunks, usage }) => {
        if (chunks && chunks.length > 0) Object.assign(message.chunks, chunks);
        if (usage) {
          if (message.usage) {
            Object.assign(message.usage, usage);
          } else {
            message.usage = usage;
          }
        }
        this.emitUpdate(id);
      },
      { wait: 16 }
    );
    const promise = handleCompletion({
      adapter,
      messages,
      model: chat.settings.modelId,
      onUpdate: debouncedOnUpdate.maybeExecute,
      reasoningEffort: chat.settings.reasoning,
      signal: controller.signal,
      system,
      tools: tools.toUndefined()
    })
      .match(
        () => {
          debouncedOnUpdate.flush();
          finalizeChat(chat, newPath);
        },
        (error) => {
          debouncedOnUpdate.cancel();
          if (controller.signal.aborted) return;
          finalizeChat(chat, newPath, formatError(error));
          console.error(error);
        }
      )
      .finally(() => {
        this.emitUpdate(id);
        this.removeChat(id);
      });
    return { chat, controller, newPath, promise };
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
    this.chats.set(id, { chat, controller, path });
    this.emitPendingUpdate(id);
    this.emitUpdate(id);
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
