import { md } from '~/utils/markdown'

function renderAsync(input: string) {
  return md.renderAsync(input)
}

export { renderAsync }
