import type { $ZodFlattenedError } from 'zod/v4/core';

import { createStore, produce } from 'solid-js/store';
import * as z from 'zod/mini';

function createForm<TSchema extends z.core.$ZodObject, T extends object = z.output<TSchema>>(
  _: TSchema,
  initial: () => NoInfer<T>
) {
  const [form, setForm] = createStore<T>(initial());
  const [formErrors, setFormErrors] = createStore<Partial<Record<'form' | keyof T, string[]>>>({});

  function resetForm() {
    setForm(initial());
    resetFormErrors();
  }

  function resetFormErrors() {
    setFormErrors(
      produce((draft) => {
        for (const key in draft) draft[key as keyof typeof draft] = undefined;
      })
    );
  }

  return [
    { form, formErrors },
    { setForm, setFormErrors, resetForm, resetFormErrors }
  ] as const;
}
function parseFormErrors<T extends z.core.$ZodError<object>>(
  error: T
): Record<'form' | keyof $ZodFlattenedError<T>['fieldErrors'], string[]> {
  const flattenedError = z.flattenError(error);
  return {
    form: flattenedError.formErrors,
    ...flattenedError.fieldErrors
  } as Record<'form' | keyof $ZodFlattenedError<T>['fieldErrors'], string[]>;
}

export { createForm, parseFormErrors };
