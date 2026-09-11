import { createWritableMemo } from '@solid-primitives/memo';
import { on } from 'solid-js';
import * as z from 'zod/mini';
import type { $ZodFlattenedError } from 'zod/v4/core';

import { produce } from './immer';
import { createDerivedStore } from './stores';

function createForm<TSchema extends z.core.$ZodObject, T extends object = z.infer<TSchema>>(
  _: TSchema,
  memo: () => NoInfer<T>
) {
  const [form, setForm] = createWritableMemo(() => memo());
  const formStore = createDerivedStore(form);
  const [formErrors, setFormErrors] = createWritableMemo<
    Partial<Record<'form' | keyof T, string[]>>
  >(on(memo, () => ({})));
  const formErrorsStore = createDerivedStore(formErrors);

  function resetForm() {
    setForm(() => memo());
    resetFormErrors();
  }

  function resetFormErrors() {
    setFormErrors({});
  }

  return [
    { form: formStore, formErrors: formErrorsStore },
    {
      resetForm,
      resetFormErrors,
      setForm: (fn: (value: T) => void) => {
        setForm((value) => produce(value, fn));
      },
      setFormErrors
    }
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
