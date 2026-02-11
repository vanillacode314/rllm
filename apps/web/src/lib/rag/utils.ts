import {
	AutoModel,
	AutoTokenizer,
	PreTrainedModel,
	PreTrainedTokenizer,
	Tensor
} from '@huggingface/transformers';
import { Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { IterativeTextSplitter } from '~/utils/string';
import { ragWorkerPool } from '~/workers/rag';

import type { TRAGAdapter } from './types';

const modelName = 'minishlab/potion-retrieval-32M';
const modelConfig = { config: { model_type: 'model2vec' }, dtype: 'fp32' };
const tokenizerConfig = {};
let modelPromise: Promise<PreTrainedModel>;
let tokenizerPromise: Promise<PreTrainedTokenizer>;

async function getEmbedding(text: string): Promise<number[]> {
	modelPromise ??= AutoModel.from_pretrained(modelName, modelConfig);
	tokenizerPromise ??= AutoTokenizer.from_pretrained(modelName, tokenizerConfig);
	const model = await modelPromise;
	const tokenizer = await tokenizerPromise;

	const { input_ids } = await tokenizer([text], {
		add_special_tokens: false,
		return_tensor: false
	});

	const cumsum = (arr: number[]) =>
		arr.reduce((acc, num, i) => [...acc, num + (acc[i - 1] || 0)], [] as number[]);
	const offsets = [0, ...cumsum(input_ids.slice(0, -1).map((x) => x.length))];

	const flattened_input_ids = input_ids.flat();
	const modelInputs = {
		input_ids: new Tensor('int64', flattened_input_ids, [flattened_input_ids.length]),
		offsets: new Tensor('int64', offsets, [offsets.length])
	};

	const { embeddings } = await model(modelInputs);
	return Array.from(embeddings.data);
}

const splitter = new IterativeTextSplitter({
	chunkSize: 1024,
	chunkOverlap: 256,
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
					const worker = await ragWorkerPool.get();
					try {
						const embeddings = await worker.getEmbedding(chunk);
						progress += 1;
						onProgress?.(progress / chunks.length);
						// console.debug(`[RAG] Progress: ${progress}/${chunks.length}`);
						return { content: chunk, embeddings, index };
					} finally {
						// console.debug('[RAG] Releasing worker');
						ragWorkerPool.release(worker);
					}
				});
				const docs = await Promise.all(promises);
				return Result.Ok(docs);
			},
			(e) => new Error(`Failed to get documents for file`, { cause: e })
		);
	}
} satisfies Partial<TRAGAdapter>);

const makeRagAdapter = (
	adapter: Omit<TRAGAdapter, keyof typeof baseRagAdapter> & Partial<typeof baseRagAdapter>
) => {
	return Object.freeze({
		...baseRagAdapter,
		...adapter
	});
};
export { getEmbedding, makeRagAdapter };
