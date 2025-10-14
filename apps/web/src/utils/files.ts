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

export { compressImageFile, fileToBase64 };
