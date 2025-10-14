import { ArkError, type } from 'arktype';
import { createStore } from 'solid-js/store';

import { create } from './mutative';

function createForm<TSchema extends type.Any<object>, const TInitial = NoInfer<TSchema['infer']>>(
	schema: TSchema,
	initial: () => TInitial
) {
	const [form, setForm] = createStore(initial() as TSchema['infer']);
	const [formErrors, setFormErrors] = createStore<
		Partial<Record<'form' | keyof typeof schema.infer, string[]>>
	>({});

	function resetForm() {
		setForm(initial() as TSchema['infer']);
		resetFormErrors();
	}

	function resetFormErrors() {
		setFormErrors(
			create((draft) => {
				for (const key in draft) {
					draft[key] = undefined!;
				}
			})
		);
	}

	return [
		{ form, formErrors },
		{ setForm, setFormErrors, resetForm, resetFormErrors }
	] as const;
}

function parseFormErrors<T extends type.errors>(
	input: T
): Record<'form' | keyof T['byPath'], string[]> {
	return input.reduce(
		(errors, error) => {
			const name = String(error.path.at(-1) ?? 'form');
			errors[name] ??= [];
			if (error.code === 'union') {
				const subErrors = parseFormErrors((error as ArkError<'union'>).errors as type.errors);
				errors[name].push(Object.values(subErrors)[0][0]);
				return errors;
			}
			const { problem } = error;
			errors[name].push(problem);
			return errors;
		},
		{} as Record<string, string[]>
	) as Record<'form' | keyof T['byPath'], string[]>;
}

export { createForm, parseFormErrors };
