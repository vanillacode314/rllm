import { makePersisted } from '@solid-primitives/storage';
import localforage from 'localforage';
import { createSignal } from 'solid-js';
import { Option } from 'ts-result-option';

import type { TChatSettings } from '~/lib/chat/settings';
import type { TMessage } from '~/types/chat';

import { ReactiveTree, type TTree } from '~/utils/tree';

export const [prompt, setPrompt] = makePersisted(createSignal<string>(''), {
	name: 'rllm:prompt',
	storage: localforage
});

export const [chatSettings, setChatSettings] = createSignal<Option<TChatSettings>>(Option.None());
export const [messages, setMessages] = createSignal<TTree<TMessage>>(new ReactiveTree());
export const [feedbackEnabled, setFeedbackEnabled] = makePersisted(createSignal<boolean>(false), {
	name: 'rllm:feedback-enabled',
	storage: localforage
});
