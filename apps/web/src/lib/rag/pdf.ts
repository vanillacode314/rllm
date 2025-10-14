import { PDFParse } from 'pdf-parse';

import url from '../../../../../node_modules/pdf-parse/dist/pdf-parse/web/pdf.worker.mjs?url';
PDFParse.setWorker(url);
import { AsyncResult, Result } from 'ts-result-option';
import { tryBlock } from 'ts-result-option/utils';

import { makeRagAdapter } from './utils';

function pdfToString(buffer: ArrayBuffer): AsyncResult<string, Error> {
	return tryBlock<string, Error>(
		async function* () {
			const pdf = yield* Result.from(
				() => new PDFParse({ data: buffer }),
				(e) => new Error('Failed to parse PDF', { cause: e })
			);
			const text = yield* AsyncResult.from(
				() => pdf.getText(),
				(e) => new Error('Failed to extract text from PDF', { cause: e })
			);
			return Result.Ok(text.text);
		},
		(e) => new Error(`Failed to extract text from PDF`, { cause: e })
	);
}

const pdfRAGAdapter = makeRagAdapter({
	id: 'pdf',
	getText: (file) =>
		AsyncResult.from(
			async () => pdfToString(await file.arrayBuffer()),
			(e) => new Error('Failed to get text from PDF', { cause: e })
		),
	getDescription: (file) => AsyncResult.Ok(file.name)
});

export { pdfRAGAdapter };
