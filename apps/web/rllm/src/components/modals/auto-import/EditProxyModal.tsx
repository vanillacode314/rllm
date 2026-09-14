import { createSignal } from 'solid-js';
import { Button } from 'ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from 'ui/dialog';
import { TextField, TextFieldInput, TextFieldLabel } from 'ui/text-field';
import * as z from 'zod/mini';

import ValidationErrors from '~/components/form/ValidationErrors';
import { USER_METADATA_KEYS } from '~/constants/user-metadata';
import { logger } from '~/db/client';
import { parseProxyUrls, ProxyManager } from '~/lib/proxy';
import { fetchers } from '~/queries';
import { proxyUrlSchema } from '~/types';
import { createForm, parseFormErrors } from '~/utils/form';
import { createFunctionWithPendingSignal } from '~/utils/signals';

const [proxyUrlToEdit, setProxyUrlToEdit] = createSignal<false | string>(false);

const formSchema = z.object({ url: proxyUrlSchema });

function EditProxyModal() {
  const [{ form, formErrors }, { resetForm, resetFormErrors, setForm, setFormErrors }] = createForm(
    formSchema,
    () => ({
      url: proxyUrlToEdit() || ''
    })
  );

  const handleSave = createFunctionWithPendingSignal(async (event: Event) => {
    event.preventDefault();
    resetFormErrors();

    const parsedForm = formSchema.safeParse(form);
    if (!parsedForm.success) {
      setFormErrors(parseFormErrors(parsedForm.error));
      return;
    }

    const urlToEdit = proxyUrlToEdit();
    if (!urlToEdit) return;

    const stored = parseProxyUrls(
      await fetchers.userMetadata.byId(USER_METADATA_KEYS.CORS_PROXY_URL)
    );
    if (parsedForm.data.url !== urlToEdit && stored.includes(parsedForm.data.url)) {
      setFormErrors({ url: ['another proxy already uses this url'] });
      return;
    }

    const urls = stored.map((url) => (url === urlToEdit ? parsedForm.data.url : url));
    await logger.dispatch({
      data: {
        id: USER_METADATA_KEYS.CORS_PROXY_URL,
        value: urls.join('\n')
      },
      type: 'setUserMetadata'
    });
    void ProxyManager.updateProxyUrls(urls);
    setProxyUrlToEdit(false);
  });

  return (
    <Dialog
      modal
      onOpenChange={(open) => {
        if (!open) {
          setProxyUrlToEdit(false);
          resetForm();
          resetFormErrors();
        }
      }}
      open={!!proxyUrlToEdit()}
    >
      <DialogContent>
        <form class="grid gap-4 py-4" onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Edit proxy</DialogTitle>
            <DialogDescription>Update Proxy</DialogDescription>
          </DialogHeader>
          <TextField class="grid gap-1.5">
            <TextFieldLabel>Proxy URL</TextFieldLabel>
            <TextFieldInput
              name="url"
              onInput={(event) =>
                setForm((draft) => {
                  draft.url = event.currentTarget.value;
                })
              }
              placeholder="https://example.com/?url=%s"
              type="text"
              value={form.url}
            />
            <ValidationErrors errors={formErrors.url} />
          </TextField>
          <DialogFooter>
            <Button disabled={handleSave.pending} type="submit">
              <span>Save</span>
              <span
                class={
                  handleSave.pending ? 'icon-[line-md--loading-loop]' : 'icon-[heroicons--check]'
                }
              />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export { setProxyUrlToEdit };
export default EditProxyModal;
