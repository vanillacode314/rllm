import { tryBlock } from 'ts-result-option/utils'

import type { TMessage } from '~/types/chat'

import type { TTree } from './tree'
import { Result } from 'ts-result-option'

const getChunksForPath = (path: number[], tree: TTree<TMessage>) =>
  tryBlock<TMessage[], Error>(
    function* () {
      return Result.Ok(
        tree
          .iter(path)
          .map(({ node }) => node.unwrap().value.unwrap())
          .toArray(),
      )
    },
    (e) => new Error(`Error getting chunks for path ${path}`, { cause: e }),
  )

export { getChunksForPath }
