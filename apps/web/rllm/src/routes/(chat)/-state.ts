import { makePersisted } from '@solid-primitives/storage';
import localforage from 'localforage';
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { Option } from 'ts-result-option';

import type { TChatSettings } from '~/lib/chat/settings';
import type { TAttachment, TMessage } from '~/types/chat';

import { ReactiveTree, type TTree } from '~/utils/tree';

// oxlint-disable-next-line solid/reactivity
export const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
  name: 'rllm:prompt',
  storage: localforage
});

export const [chatSettings, setChatSettings] = createSignal<Option<TChatSettings>>(Option.None());
export const [messages, setMessages] = createSignal<TTree<TMessage>>(new ReactiveTree());
// oxlint-disable-next-line solid/reactivity
export const [feedbackEnabled, setFeedbackEnabled] = makePersisted(createSignal<boolean>(false), {
  name: 'rllm:feedback-enabled',
  storage: localforage
});
// oxlint-disable-next-line solid/reactivity
export const [attachments, setAttachments] = makePersisted(createStore<TAttachment[]>([]), {
  name: 'rllm:attachments',
  storage: localforage
});
