import { createMemo, For, Index, onCleanup, Show } from 'solid-js';
import { createStore, produce } from 'solid-js/store';

import ValidationErrors from '~/components/form/ValidationErrors';
import { Button } from '~/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle
} from '~/components/ui/dialog';
import { TextField, TextFieldInput, TextFieldTextArea } from '~/components/ui/text-field';
import { cn } from '~/utils/tailwind';

const toggleCheckbox = (questionId: string, option: string) => {
	setState(
		'responses',
		produce((responses) => {
			if (!(questionId in responses)) {
				responses[questionId] = [];
			}
			const current = responses[questionId] as string[];
			const optionIndex = current.findIndex((o) => o === option);
			if (optionIndex >= 0) {
				current.splice(optionIndex, 1);
			} else {
				current.push(option);
			}
		})
	);
};

export interface TFeedbackQuestion {
	id: string;
	options: string[];
	placeholder?: string;
	question: string;
	type?: TFeedbackQuestionType;
}

export type TFeedbackQuestionType = 'checkbox' | 'radio' | 'textarea';

export interface TFeedbackResponse {
	answer: string | string[];
	questionId: string;
}

interface FeedbackModalState {
	customAnswerErrors: Record<string, string[]>;
	customAnswers: Record<string, string[]>;
	onCancel: (() => void) | null;
	onSubmit: ((responses: TFeedbackResponse[]) => void) | null;
	open: boolean;
	questions: TFeedbackQuestion[];
	responses: Record<string, string | string[]>;
	textareaAnswers: Record<string, string>;
}

const [state, setState] = createStore<FeedbackModalState>({
	open: false,
	questions: [],
	responses: {},
	customAnswers: {},
	customAnswerErrors: {},
	textareaAnswers: {},
	onSubmit: null,
	onCancel: null
});

const reset = () => {
	setState({
		questions: [],
		responses: {},
		customAnswers: {},
		customAnswerErrors: {},
		textareaAnswers: {},
		onSubmit: null,
		onCancel: null
	});
};

const addCustomAnswer = (questionId: string) => {
	const current = state.customAnswers[questionId] ?? [];
	const hasEmpty = current.some((a) => a.trim() === '');
	if (hasEmpty) {
		setState(
			'customAnswerErrors',
			produce((errors) => {
				errors[questionId] = ['Please fill in the empty field first'];
			})
		);
		setTimeout(
			() =>
				setState(
					'customAnswerErrors',
					produce((errors) => {
						errors[questionId] = [];
					})
				),
			3000
		);
		return;
	}
	setState(
		'customAnswers',
		produce((customAnswers) => {
			if (!(questionId in customAnswers)) {
				customAnswers[questionId] = [];
			}
			customAnswers[questionId].push('');
		})
	);
};

const updateCustomAnswer = (questionId: string, index: number, value: string) => {
	setState(
		'customAnswers',
		produce((customAnswers) => {
			if (!(questionId in customAnswers)) {
				customAnswers[questionId] = [];
			}
			const customAnswer = customAnswers[questionId];
			customAnswer[index] = value;
		})
	);
};

const removeCustomAnswer = (questionId: string, index: number) => {
	setState(
		'customAnswers',
		produce((customAnswers) => {
			if (questionId in customAnswers) {
				customAnswers[questionId].splice(index, 1);
			}
		})
	);
};

interface CheckboxOptionProps {
	isChecked: boolean;
	onChange: () => void;
	option: string;
}

interface CheckboxQuestionProps {
	options: string[];
	questionId: string;
}

interface CustomAnswersInputProps {
	questionId: string;
}

interface QuestionProps {
	index: number;
	question: TFeedbackQuestion;
}

interface RadioOptionProps {
	isChecked: boolean;
	onChange: () => void;
	option: string;
}

interface RadioQuestionProps {
	options: string[];
	questionId: string;
}

interface TextareaQuestionProps {
	placeholder?: string;
	questionId: string;
}

export function FeedbackModal() {
	onCleanup(() => {
		state.onCancel?.();
		reset();
	});
	const handleSubmit = () => {
		const result: TFeedbackResponse[] = [];
		for (const question of state.questions) {
			const questionType = question.type ?? 'radio';

			if (questionType === 'textarea') {
				const answer = state.textareaAnswers[question.id] ?? '';
				result.push({
					questionId: question.id,
					answer
				});
			} else if (questionType === 'checkbox') {
				const selected = (state.responses[question.id] as string[]) ?? [];
				const customAnswers = (state.customAnswers[question.id] ?? []).filter(
					(a) => a.trim() !== ''
				);
				const answer = [...selected.filter((s) => s !== '___custom'), ...customAnswers];
				result.push({
					questionId: question.id,
					answer
				});
			} else {
				const answer = state.responses[question.id] as string;
				const customAnswer = state.customAnswers[question.id] ?? '';
				result.push({
					questionId: question.id,
					answer: answer === '___custom' ? customAnswer : answer
				});
			}
		}
		state.onSubmit?.(result);
		setState('open', false);
		reset();
	};

	return (
		<Dialog
			modal
			onOpenChange={(value) => {
				if (!value) {
					state.onCancel?.();
					reset();
				}
				setState('open', value);
			}}
			open={state.open}
		>
			<DialogContent class="sm:max-w-125 p-0">
				<div class="max-h-[90vh] overflow-hidden grid grid-rows-[auto_1fr_auto] py-6">
					<DialogHeader class="px-6">
						<DialogTitle>Answer These</DialogTitle>
						<DialogDescription>The LLM is asking you these questions</DialogDescription>
					</DialogHeader>
					<div class="grid gap-6 py-4 overflow-y-auto px-6">
						<For each={state.questions}>
							{(question, index) => <Question index={index()} question={question} />}
						</For>
					</div>
					<DialogFooter class="px-6">
						<Button
							onClick={() => {
								setState('open', false);
								state.onCancel?.();
							}}
							type="button"
							variant="secondary"
						>
							Cancel
						</Button>
						<Button onClick={handleSubmit} type="button">
							Submit
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}

function CheckboxOption(props: CheckboxOptionProps) {
	return (
		<label
			class={cn(
				'flex items-start gap-3 rounded-lg border p-3 text-sm transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				props.isChecked ?
					'border-ring bg-ring/10 text-ring'
				:	'border-input bg-background text-foreground'
			)}
		>
			<input checked={props.isChecked} class="hidden" onChange={props.onChange} type="checkbox" />
			<span
				aria-hidden="true"
				class={cn(
					'mt-0.5 h-4 w-4 shrink-0 rounded border-2 ring-offset-background',
					props.isChecked ? 'border-ring bg-ring' : 'border-muted-foreground'
				)}
			>
				<Show when={props.isChecked}>
					<svg
						class="h-full w-full text-background"
						fill="none"
						stroke="currentColor"
						stroke-width="3"
						viewBox="0 0 24 24"
					>
						<path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</Show>
			</span>
			<span class="whitespace-pre-wrap">{props.option}</span>
		</label>
	);
}

function CheckboxQuestion(props: CheckboxQuestionProps) {
	const selectedOptions = createMemo(() => (state.responses[props.questionId] as string[]) ?? []);
	const hasCustom = createMemo(() => selectedOptions().includes('___custom'));

	const handleCustomToggle = () => {
		if (!hasCustom()) {
			toggleCheckbox(props.questionId, '___custom');
			addCustomAnswer(props.questionId);
		} else {
			toggleCheckbox(props.questionId, '___custom');
			setState(
				'customAnswers',
				produce((customAnswers) => {
					customAnswers[props.questionId] = [];
				})
			);
		}
	};

	return (
		<div class="grid gap-2">
			<For each={props.options}>
				{(option) => {
					const isChecked = createMemo(() => selectedOptions().includes(option));
					return (
						<CheckboxOption
							isChecked={isChecked()}
							onChange={() => toggleCheckbox(props.questionId, option)}
							option={option}
						/>
					);
				}}
			</For>
			<Show when={props.options.length > 0}>
				<CheckboxOption isChecked={hasCustom()} onChange={handleCustomToggle} option="Other" />
				<Show when={hasCustom()}>
					<CustomAnswersInput questionId={props.questionId} />
				</Show>
			</Show>
		</div>
	);
}

function CustomAnswersInput(props: CustomAnswersInputProps) {
	return (
		<div class="mt-2 grid gap-2">
			<Index each={state.customAnswers[props.questionId] ?? []}>
				{(value, index) => (
					<div class="flex gap-2">
						<TextField class="flex-1">
							<TextFieldInput
								onInput={(e) => updateCustomAnswer(props.questionId, index, e.currentTarget.value)}
								placeholder="Enter custom answer..."
								type="text"
								value={value() ?? ''}
							/>
						</TextField>
						<Button
							class="shrink-0"
							onClick={() => removeCustomAnswer(props.questionId, index)}
							size="icon"
							type="button"
							variant="ghost"
						>
							<svg
								class="h-4 w-4"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<path d="M6 18L18 6M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</Button>
					</div>
				)}
			</Index>
			<button
				class="text-sm text-muted-foreground hover:text-foreground"
				onClick={() => addCustomAnswer(props.questionId)}
				type="button"
			>
				+ Add another
			</button>
			<ValidationErrors errors={state.customAnswerErrors[props.questionId]} />
		</div>
	);
}

function Question(props: QuestionProps) {
	return (
		<div class="grid gap-2">
			<span class="text-sm font-medium">
				{props.index + 1}. {props.question.question}
			</span>
			<Show when={props.question.type === 'textarea'}>
				<TextareaQuestion placeholder={props.question.placeholder} questionId={props.question.id} />
			</Show>
			<Show when={props.question.type === 'checkbox'}>
				<CheckboxQuestion options={props.question.options} questionId={props.question.id} />
			</Show>
			<Show when={props.question.type === 'radio' || props.question.type === undefined}>
				<RadioQuestion options={props.question.options} questionId={props.question.id} />
			</Show>
		</div>
	);
}

function RadioOption(props: RadioOptionProps) {
	return (
		<label
			class={cn(
				'flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-all hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
				props.isChecked ?
					'border-ring bg-ring/10 text-ring'
				:	'border-input bg-background text-foreground'
			)}
		>
			<input checked={props.isChecked} class="hidden" onChange={props.onChange} type="radio" />
			<span
				aria-hidden="true"
				class={cn(
					'mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ring-offset-background',
					props.isChecked ? 'border-ring bg-ring' : 'border-muted-foreground'
				)}
			/>
			<span class="whitespace-pre-wrap">{props.option}</span>
		</label>
	);
}

function RadioQuestion(props: RadioQuestionProps) {
	const selectedOption = createMemo(() => state.responses[props.questionId]);
	const hasCustom = createMemo(() => selectedOption() === '___custom');

	const handleOptionChange = (option: string) => {
		setState('responses', props.questionId, option);
	};

	return (
		<div class="grid gap-2">
			<For each={props.options}>
				{(option) => (
					<RadioOption
						isChecked={selectedOption() === option}
						onChange={() => handleOptionChange(option)}
						option={option}
					/>
				)}
			</For>
			<Show when={props.options.length > 0}>
				<RadioOption
					isChecked={hasCustom()}
					onChange={() => setState('responses', props.questionId, '___custom')}
					option="Other"
				/>
				<Show when={hasCustom()}>
					<TextField class="mt-1">
						<TextFieldInput
							onInput={(e) =>
								setState(
									'customAnswers',
									produce((customAnswers) => {
										customAnswers[props.questionId] = [e.currentTarget.value];
									})
								)
							}
							placeholder="Enter your answer..."
							type="text"
							value={state.customAnswers[props.questionId] ?? ''}
						/>
					</TextField>
				</Show>
			</Show>
			<Show when={selectedOption() !== undefined && selectedOption() !== ''}>
				<button
					class="mt-1 text-sm text-muted-foreground hover:text-foreground"
					onClick={() => {
						setState('responses', props.questionId, '');
						setState(
							'customAnswers',
							produce((customAnswers) => {
								customAnswers[props.questionId] = [];
							})
						);
					}}
					type="button"
				>
					Clear selection
				</button>
			</Show>
		</div>
	);
}

function TextareaQuestion(props: TextareaQuestionProps) {
	return (
		<TextField>
			<TextFieldTextArea
				class="min-h-25 resize-y"
				onInput={(e) => setState('textareaAnswers', props.questionId, e.currentTarget.value)}
				placeholder={props.placeholder ?? 'Enter your answer...'}
				value={state.textareaAnswers[props.questionId] ?? ''}
			/>
		</TextField>
	);
}

export default FeedbackModal;

export const useFeedbackModal = () => ({
	open(questions: TFeedbackQuestion[]): Promise<null | TFeedbackResponse[]> {
		const { promise, resolve } = Promise.withResolvers<null | TFeedbackResponse[]>();
		setState({
			open: true,
			questions,
			responses: {},
			customAnswers: {},
			textareaAnswers: {},
			onSubmit: resolve,
			onCancel: () => resolve(null)
		});
		return promise;
	},
	close() {
		setState('open', false);
		reset();
	},
	resetStore: reset
});
