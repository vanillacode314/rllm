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

import { ValidationErrors } from '~/components/form/ValidationErrors';
import { db } from '~/db/client';
import { ProxyManager } from '~/lib/proxy';
import { proxyUrlSchema } from '~/types';
import { createForm, parseFormErrors } from '~/utils/form';
import { createFunctionWithPendingSignal } from '~/utils/signals';

const [isOpen, setOpen] = createSignal(false);

const formSchema = z.object({ url: proxyUrlSchema });

function AddProxyModal() {
  const [{ form, formErrors }, { resetForm, resetFormErrors, setForm, setFormErrors }] = createForm(
    formSchema,
    () => ({
      url: ''
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

    const stored = await db.userMetadata.corsProxyUrls();
    if (stored.includes(parsedForm.data.url)) {
      setFormErrors({ url: ['this proxy is already in the list'] });
      return;
    }

    const urls = [...stored, parsedForm.data.url];
    await db.userMetadata.setCorsProxyUrls(urls);
    void ProxyManager.updateProxyUrls(urls);
    setOpen(false);
  });

  return (
    <Dialog
      modal
      onOpenChange={(open) => {
        setOpen(open);
        resetForm();
        resetFormErrors();
      }}
      open={isOpen()}
    >
      <DialogContent>
        <form class="grid gap-4 py-4" onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Add proxy</DialogTitle>
            <DialogDescription>
              Added to the end of the list. Proxies are tried in order and the first working one
              handles requests.
            </DialogDescription>
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
              <span>Add</span>
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

export { setOpen as setAddProxyModalOpen };
export default AddProxyModal;
