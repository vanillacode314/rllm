import Compressor from 'compressorjs';
import { AsyncResult } from 'ts-result-option';

function compressImageFile(file: File, options: Omit<Compressor.Options, 'error' | 'success'>) {
	const { promise, resolve, reject } = Promise.withResolvers<Blob | File>();
	new Compressor(file, {
		...options,
		success(result) {
			resolve(result);
		},
		error(e) {
			reject(e);
		}
	});
	return AsyncResult.from(
		() => promise,
		(e) => new Error('Error compressing image', { cause: e })
	);
}

function fileToBase64(file: File) {
	return new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = (error) => reject(error);
		reader.readAsDataURL(file);
	});
}

function getFile(accept?: string): Promise<File | null> {
	const { promise, resolve } = Promise.withResolvers<File | null>();
	const input = document.createElement('input');
	input.type = 'file';
	if (accept) input.accept = accept;
	input.onchange = (e) => {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (file) resolve(file);
		else resolve(null);
	};
	input.click();
	return promise;
}

export { compressImageFile, fileToBase64, getFile };
