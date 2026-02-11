import { useQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { toast } from 'solid-sonner';
import * as z from 'zod/mini';

import ValidationErrors from '~/components/form/ValidationErrors';
import { Button } from '~/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '~/components/ui/card';
import { TextField, TextFieldInput, TextFieldLabel } from '~/components/ui/text-field';
import { logger } from '~/db/client';
import { ProxyManager } from '~/lib/proxy';
import { queries } from '~/queries';
import { createForm, parseFormErrors } from '~/utils/form';
import { queryClient } from '~/utils/query-client';

export const Route = createFileRoute('/settings/proxy')({
  component: SettingsProxyComponent,
  loader: async () => {
    await queryClient.ensureQueryData(queries.userMetadata.byId('cors-proxy-url'));
  }
});

const formSchema = z.object({
  url: z.union([z.literal(''), z.url().check(z.refine((value) => value.includes('%s')))], {
    error: 'must be a url with a %s placeholder or empty'
  })
});
function SettingsProxyComponent() {
  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'));
  const [{ form, formErrors }, { setFormErrors, setForm, resetFormErrors }] = createForm(
    formSchema,
    () => ({
      url: proxyUrl.data ?? ''
    })
  );
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        resetFormErrors();
        const parsedForm = formSchema.safeParse(form);
        if (!parsedForm.success) {
          setFormErrors(parseFormErrors(parsedForm.error));
          return;
        }
        if (proxyUrl.data === parsedForm.data.url) {
          toast.info('No changes to save');
          return;
        }
        await logger.dispatch({
          type: 'setUserMetadata',
          data: {
            id: 'cors-proxy-url',
            value: parsedForm.data.url
          }
        });
        await ProxyManager.updateProxyUrl(parsedForm.data.url || null);
        toast.success('Proxy URL saved');
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Cors Proxy</CardTitle>
          <CardDescription>
            Set this if you are using providers or mcp servers that don't set cors headers correctly
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TextField class="space-y-1.5">
            <TextFieldLabel>Proxy URL</TextFieldLabel>
            <TextFieldInput
              id="url"
              name="url"
              onInput={(e) => setForm('url', e.currentTarget.value)}
              placeholder="https://example.com/?url=%s"
              type="text"
              value={form.url}
            />
            <ValidationErrors errors={formErrors.url} />
          </TextField>
        </CardContent>
        <CardFooter class="flex justify-end">
          <Button class="max-sm:w-full" type="submit">
            <span class="icon-[heroicons--check] text-lg" />
            <span>Save</span>
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
