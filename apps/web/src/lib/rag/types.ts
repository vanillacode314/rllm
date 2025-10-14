import type { AsyncResult } from 'ts-result-option';

import { type } from 'arktype';

const ragAdapterSchema = type({
	id: 'string',
	handleFile: type('Function').as<
		(file: File) => AsyncResult<
			{
				content: string;
				desc?: string;
				title: string;
			},
			Error
		>
	>()
});
type TRAGAdapter = typeof ragAdapterSchema.infer;

export { ragAdapterSchema };
export type { TRAGAdapter };
