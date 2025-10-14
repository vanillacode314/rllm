import type { AsyncResult } from 'ts-result-option';

interface TDocument {
	content: string;
	embeddings: number[];
}

interface TRAGAdapter {
	getDescription: (file: File) => AsyncResult<string, Error>;
	getDocuments: (
		file: File,
		opt: { onProgress?: (progress: number) => void }
	) => AsyncResult<TDocument[], Error>;
	getText: (file: File) => AsyncResult<string, Error>;
	id: string;
}

export type { TRAGAdapter };
