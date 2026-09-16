import { Option } from 'ts-result-option';
import * as z from 'zod/mini';

import { useFeedbackModal } from '~/components/modals/auto-import/FeedbackModal';
import {
  ASK_QUESTIONS_TOOL_PROMPT,
  ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT,
  HANDOFF_TOOL_INSTRUCTIONS_PROMPT
} from '~/constants/prompts';
import { vectorDb } from '~/lib/vector-db/client';
import { transientDb } from '~/lib/vector-db/transient';
import type { TTool } from '~/types';
import type { TAttachment } from '~/types/chat';

import { makeTool } from './utils';

class RetriableToolRegistry {
  static #tools = new Map<string, TTool>();

  static get(name: string): Option<TTool> {
    return Option.fromUndefined(this.#tools.get(name));
  }

  static has(name: string): boolean {
    return this.#tools.has(name);
  }

  static register(tool: TTool): void {
    this.#tools.set(tool.name, tool);
  }
}

const askQuestionsTool = makeTool({
  description: ASK_QUESTIONS_TOOL_PROMPT,
  handler: async (args, signal) => {
    signal?.throwIfAborted();
    const { questions } = args;
    for (const question of questions) {
      if (question.options === undefined) continue;
      for (let i = question.options.length - 1, j = 0; i >= 0; i--, j++) {
        if (question.options[i].trim().toLowerCase() === 'other') question.options.splice(i, 1);
      }
    }
    const responses = await useFeedbackModal().open(questions);
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

RetriableToolRegistry.register(askQuestionsTool);

function makeAttachmentsTool(attachments: TAttachment[]): TTool {
  const attachmentsByTransientStatus = {
    library: new Set(
      attachments.filter((attachment) => !attachment.transient).map((attachment) => attachment.id)
    ),
    transient: new Set(
      attachments.filter((attachment) => attachment.transient).map((attachment) => attachment.id)
    )
  };
  return makeTool({
    description: ATTACHMENT_TOOL_INSTRUCTIONS_PROMPT(
      attachments.map((attachement) => `${attachement.id}: ${attachement.description}`)
    ),
    handler: async (args, signal) => {
      signal?.throwIfAborted();
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
            limit: offset + limit,
            signal
          }),
          await vectorDb.query(query, {
            afterIndex,
            beforeIndex,
            documentIds: args.ids.filter((id) => attachmentsByTransientStatus.library.has(id)),
            limit: offset + limit,
            signal
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
}

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

export { askQuestionsTool, handoffTool, makeAttachmentsTool, RetriableToolRegistry };
