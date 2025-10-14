import { AutoModel, AutoTokenizer, type Tensor } from '@huggingface/transformers';

const MODEL = 'BAAI/bge-small-en-v1.5';
const TOK = 'BAAI/bge-small-en-v1.5';
const MAX = 256;

async function getEmbedding(text: string): Promise<Tensor> {
	const tokenizer = await AutoTokenizer.from_pretrained(TOK);
	const model = await AutoModel.from_pretrained(MODEL);

	const { input_ids, attention_mask } = tokenizer(text, {
		padding: true,
		truncation: true,
		max_length: MAX,
		return_tensors: 'pt'
	});

	const { last_hidden_state } = await model({ input_ids, attention_mask });
	const embeddings = last_hidden_state.mean(1);

	return embeddings;
}
