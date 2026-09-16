import { Throttler } from '@tanstack/solid-pacer';
import type { Accessor } from 'solid-js';
import { createMemo, from } from 'solid-js';
import { Option } from 'ts-result-option';

import { MATH_SYSTEM_PROMPT, WEB_SEARCH_SYSTEM_PROMPT } from '~/constants/prompts';
import type { TProvider } from '~/db/app-schema';
import { db } from '~/db/client';
import { OpenAIAdapter } from '~/lib/adapters/openai';
import { MCPManager } from '~/lib/mcp/manager';
import { finalizeChat } from '~/routes/(chat)/-utils';
import type { TTool } from '~/types';
import type { TAttachment, TChat, TLLMMessageChunk, TMessage } from '~/types/chat';
import { getMessagesForPath } from '~/utils/chat';
import { formatError } from '~/utils/errors';
import { Tree, TreeNode } from '~/utils/tree';

import { executeToolCalls, handleCompletion } from '..';
import {
  askQuestionsTool,
  handoffTool,
  makeAttachmentsTool,
  RetriableToolRegistry
} from '../tools';
import type { ChatGenerationStorage } from './storages';

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
    feedbackEnabled: boolean = false,
    retry: boolean = false,
    retryToolCallIds: string[] = []
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

    function insertTool(tool: TTool) {
      tools = Option.Some(
        tools.mapOr([tool], (tools) => {
          tools.push(tool);
          return tools;
        })
      );
    }

    function resetMessage(message: TMessage & { type: 'llm' }) {
      message.error = undefined;
      message.finished = false;
      message.model = chat.settings.modelId;
      message.provider = provider.name;
      message.usage = undefined;
    }
    let message: TMessage & { type: 'llm' };
    let newPath: number[];
    if (retryToolCallIds.length > 0) {
      const sourceMessage = node.value.expect(
        `should be able to traverse to node at ${JSON.stringify(path)}`
      );
      if (sourceMessage.type !== 'llm') throw new Error('can only retry llm messages');
      const parentPath = path.slice(0, -1);
      const parentNode = chat.messages
        .traverse(parentPath)
        .expect(`should be able to traverse to node at ${JSON.stringify(parentPath)}`);
      message = structuredClone(sourceMessage);
      const lastRetriedIndex = message.chunks.findLastIndex(
        (chunk) => chunk.type === 'tool_call' && retryToolCallIds.includes(chunk.id)
      );
      if (lastRetriedIndex !== -1) message.chunks = message.chunks.slice(0, lastRetriedIndex + 1);
      resetMessage(message);
      parentNode.addChild(new TreeNode(message));
      newPath = parentPath.concat(parentNode.children.length - 1);
    } else if (retry) {
      const erroredMessage = node.value.expect(
        `should be able to traverse to node at ${JSON.stringify(path)}`
      );
      if (erroredMessage.type !== 'llm') throw new Error('can only retry llm messages');
      message = erroredMessage;
      resetMessage(message);
      newPath = path;
    } else {
      message = {
        chunks: [],
        finished: false,
        model: chat.settings.modelId,
        provider: provider.name,
        type: 'llm'
      };
      node.addChild(new TreeNode(message));
      newPath = [...path, node.children.length - 1];
    }
    chat.finished = false;
    this.emitUpdate(id);
    const messages = getMessagesForPath(newPath, chat.messages).unwrap();

    if (attachments.length > 0) insertTool(makeAttachmentsTool(attachments));
    if (feedbackEnabled) insertTool(askQuestionsTool);

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

    if (isHandoffMode()) insertTool(handoffTool);

    this.addChat(id, chat, controller, newPath);
    if (retryToolCallIds.length > 0) {
      const tool_calls = message.chunks.filter(
        (chunk): chunk is TLLMMessageChunk & { type: 'tool_call' } =>
          chunk.type === 'tool_call' && retryToolCallIds.includes(chunk.id)
      );
      for (const tool_call of tool_calls) {
        tool_call.content = '';
        tool_call.success = null;
      }
      const retryTools = [...new Set(tool_calls.map((tool_call) => tool_call.tool.name))]
        .map((name) => RetriableToolRegistry.get(name))
        .filter((tool) => tool.isSome())
        .map((tool) => tool.unwrap());
      this.emitUpdate(id);
      await executeToolCalls(tool_calls, retryTools, controller.signal, () =>
        this.emitUpdate(id)
      ).inspectErr(console.error);
    }
    const prompts = [MATH_SYSTEM_PROMPT] as string[];
    if (chat.settings.includeDateTimeInSystemPrompt)
      prompts.push(`Current date and time: ${this.formatCurrentDateTime()}`);
    if (chat.settings.systemPrompt) prompts.push(chat.settings.systemPrompt);
    const webSearchMcpId = await db.userMetadata.webSearchMcpId();
    if (webSearchMcpId && MCPManager.getClient(webSearchMcpId)?.status === 'connected') {
      prompts.push(WEB_SEARCH_SYSTEM_PROMPT);
    }
    const system = prompts.join('\n\n');

    const throttledUpdate = new Throttler(
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
      onUpdate: throttledUpdate.maybeExecute,
      reasoningEffort: chat.settings.reasoning,
      sessionId: chat.id,
      signal: controller.signal,
      system,
      tools: tools.toUndefined()
    })
      .match(
        () => {
          throttledUpdate.flush();
          finalizeChat(chat, newPath);
        },
        (error) => {
          throttledUpdate.cancel();
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
