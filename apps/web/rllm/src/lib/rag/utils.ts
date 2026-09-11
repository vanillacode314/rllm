import { Tokenizer } from '@huggingface/tokenizers';
import localforage from 'localforage';
import * as ort from 'onnxruntime-web/wasm';
import { Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { IterativeTextSplitter } from '~/utils/string';
import * as rag from '~/workers/rag';

import ortMjs from '../../../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';
import ortWasm from '../../../../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import type { TRAGAdapter } from './types';

const MODEL_URL =
  'https://huggingface.co/minishlab/potion-retrieval-32m-onnx/resolve/main/model.onnx';
const TOKENIZER_URL =
  'https://huggingface.co/minishlab/potion-retrieval-32m-onnx/resolve/main/tokenizer.json';
const TOKENIZER_CONFIG_URL =
  'https://huggingface.co/minishlab/potion-retrieval-32m-onnx/resolve/main/tokenizer_config.json';

ort.env.wasm.wasmPaths = { mjs: ortMjs, wasm: ortWasm };

let session: ort.InferenceSession | undefined;
let tokenizer: Tokenizer | undefined;

export async function getEmbedding(
  text: string,
  onProgress?: (n: number) => void
): Promise<number[]> {
  const { session, tokenizer } = await load(onProgress);

  const { ids } = tokenizer.encode(text, { add_special_tokens: false });

  // 3. The model2vec ONNX graph is a torch EmbeddingBag(mean):
  //    flat input_ids + an offsets vector marking where the (single) sequence starts.
  const inputIds = new ort.Tensor('int64', BigInt64Array.from(ids.map(BigInt)), [1, ids.length]);
  const attentionMask = new ort.Tensor(
    'int64',
    BigInt64Array.from(new Array(ids.length).fill(1n)),
    [1, ids.length]
  );

  // 4. Run and read out. Output name is `embeddings`, already L2-normalized.
  const { embeddings } = await session.run({ attention_mask: attentionMask, input_ids: inputIds });
  return Array.from(embeddings.data as Float32Array);
}

async function load(onProgress?: (n: number) => void) {
  if (session !== undefined && tokenizer !== undefined) {
    onProgress?.(1);
    return { session, tokenizer };
  }
  const [buffer, json, config] = await navigator.locks.request('load_rag_model', async () => {
    let bufferPromise = localforage.getItem<Uint8Array>('rag-model').then(
      (buffer) =>
        buffer ??
        fetch(MODEL_URL).then(async (res) => {
          const reader = res.body?.getReader();
          if (!reader) throw new Error('Failed to get reader');
          const contentLength = Number(res.headers.get('Content-Length'));
          let receivedLength = 0;
          const buffer = new Uint8Array(contentLength);
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer.set(value, receivedLength);
            receivedLength += value.length;
            onProgress?.(receivedLength / contentLength);
          }
          return localforage.setItem('rag-model', buffer);
        })
    );
    const jsonPromise = localforage.getItem('rag-tokenizer').then(
      (json) =>
        json ??
        fetch(TOKENIZER_URL)
          .then((res) => res.json())
          .then((json) => localforage.setItem('rag-tokenizer', json))
    );
    const configPromise = localforage.getItem('rag-tokenizer-config').then(
      (config) =>
        config ??
        fetch(TOKENIZER_CONFIG_URL)
          .then((res) => res.json())
          .then((config) => localforage.setItem('rag-tokenizer-config', config))
    );
    return await Promise.all([bufferPromise, jsonPromise, configPromise]);
  });
  onProgress?.(1);
  session = await ort.InferenceSession.create(buffer);
  tokenizer = new Tokenizer(json, config);

  return { session, tokenizer };
}

export const splitter = new IterativeTextSplitter({
  chunkOverlap: 256,
  chunkSize: 1024,
  cleanWhitespace: true
});

const baseRagAdapter = Object.freeze({
  getDocuments(file, opts = {}) {
    return tryBlock(
      this,
      async function* () {
        const { onProgress } = opts;
        const content = yield* this.getText!(file);
        const chunks = splitter.splitText(content);
        console.debug('[RAG] Got Chunks:', chunks.length);
        let progress = 0;
        const promises = chunks.map(async (chunk, index) => {
          const embeddings = await rag.getEmbedding(chunk);
          progress += 1;
          onProgress?.(progress / chunks.length);
          // console.debug(`[RAG] Progress: ${progress}/${chunks.length}`);
          return { content: chunk, embeddings, index };
        });
        const docs = await Promise.all(promises);
        return Result.Ok(docs);
      },
      (e) => new Error(`Failed to get documents for file`, { cause: e })
    );
  }
} satisfies Partial<TRAGAdapter>);

export const makeRagAdapter = (
  adapter: Omit<TRAGAdapter, keyof typeof baseRagAdapter> & Partial<typeof baseRagAdapter>
) => {
  return Object.freeze({
    ...baseRagAdapter,
    ...adapter
  });
};
