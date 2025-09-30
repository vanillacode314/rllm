import { createFileRoute } from '@tanstack/solid-router'
import { type } from 'arktype'

import {
  TextField,
  TextFieldInput,
  TextFieldLabel,
} from '~/components/ui/text-field'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  CardDescription,
} from '~/components/ui/card'
import { createForm, parseFormErrors } from '~/utils/form'
import ValidationErrors from '~/components/form/ValidationErrors'
import { createMessages } from '~/utils/messages'
import { queryClient } from '~/utils/query-client'
import { queries } from '~/queries'
import { toast } from 'solid-sonner'
import { useQuery } from '@tanstack/solid-query'

export const Route = createFileRoute('/settings/proxy')({
  component: SettingsProxyComponent,
  loader: async () => {
    await queryClient.ensureQueryData(
      queries.userMetadata.byId('cors-proxy-url'),
    )
  },
})

const formSchema = type({
  url: type('string.url')
    .narrow((value, ctx) => {
      if (value.includes('%s')) return true
      return ctx.reject({
        problem: 'must be a url with a %s placeholder',
      })
    })
    .or("''")
    .configure({
      problem: () => 'must be a url with a %s placeholder or empty',
    }),
})
function SettingsProxyComponent() {
  const proxyUrl = useQuery(() => queries.userMetadata.byId('cors-proxy-url'))
  const [{ form, formErrors }, { setFormErrors, setForm, resetFormErrors }] =
    createForm(formSchema, () => ({
      url: proxyUrl.data,
    }))
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault()
        resetFormErrors()
        const parsedFormData = formSchema(form)
        if (parsedFormData instanceof type.errors) {
          setFormErrors(parseFormErrors(parsedFormData))
          return
        }
        await createMessages({
          user_intent: 'set_user_metadata',
          meta: {
            id: 'cors-proxy-url',
            value: parsedFormData.url,
          },
        })
        await queryClient.invalidateQueries(
          queries.userMetadata.byId('cors-proxy-url'),
        )
        toast.success('Proxy URL saved')
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Cors Proxy</CardTitle>
          <CardDescription>
            Set this if you are using providers or mcp servers that don't set
            cors headers correctly
          </CardDescription>
        </CardHeader>

        <CardContent>
          <TextField class="space-y-1.5">
            <TextFieldLabel>Proxy URL</TextFieldLabel>
            <TextFieldInput
              type="text"
              name="url"
              id="url"
              placeholder="https://example.com/?url=%s"
              value={form.url}
              onInput={(e) => setForm('url', e.currentTarget.value)}
            />
            <ValidationErrors errors={formErrors.url} />
          </TextField>
        </CardContent>
        <CardFooter class="flex justify-end">
          <Button type="submit">
            <span>Save</span>
            <span class="icon-[heroicons--check-circle] text-lg" />
          </Button>
        </CardFooter>
      </Card>
    </form>
  )
}
