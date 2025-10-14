import { AsyncResult, Result } from 'ts-result-option';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const MAX_CHUNK_SIZE = 64 * 1024 * 1024;
const CHUNKED_TAG_STR = 'CHUNKED:';
const SINGLE_TAG_STR = 'SINGLE:';
const CHUNKED_TAG = encoder.encode(CHUNKED_TAG_STR);
const SINGLE_TAG = encoder.encode(SINGLE_TAG_STR);
const IV_BYTE_LENGTH = 12;
const CHUNK_COUNT_BYTE_LENGTH = 4;

const encryptDataWithKey = (
	secretData: string,
	aesKey: CryptoKey,
	signal?: AbortSignal
): AsyncResult<string, Error> => {
	if (signal?.aborted) {
		throw new Error('Operation aborted');
	}
	const data = encoder.encode(secretData);
	return data.byteLength <= MAX_CHUNK_SIZE ?
			encryptSingleChunk(data, aesKey, signal)
		:	encryptMultiChunk(data, aesKey, signal);
};

const encryptSingleChunk = (
	data: Uint8Array<ArrayBuffer>,
	aesKey: CryptoKey,
	signal?: AbortSignal
) =>
	AsyncResult.from<string, Error>(
		async function () {
			const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
			const encryptedContent = await crypto.subtle.encrypt(
				{
					iv: iv,
					name: 'AES-GCM'
				},
				aesKey,
				data
			);
			if (signal?.aborted) {
				return Result.Err(new Error('Operation aborted'));
			}

			const encryptedContentArr = new Uint8Array(encryptedContent);
			const buff = new Uint8Array(
				SINGLE_TAG.byteLength + iv.byteLength + encryptedContentArr.byteLength
			);

			buff.set(SINGLE_TAG, 0);
			buff.set(iv, SINGLE_TAG.byteLength);
			buff.set(encryptedContentArr, SINGLE_TAG.byteLength + iv.byteLength);

			return Result.Ok(bufToBase64(buff));
		},
		(e) => new Error(`Error encrypting single chunk`, { cause: e })
	);

const encryptMultiChunk = (
	data: Uint8Array<ArrayBuffer>,
	aesKey: CryptoKey,
	signal?: AbortSignal
): AsyncResult<string, Error> =>
	AsyncResult.from(
		async function () {
			const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH));
			const totalChunks = Math.ceil(data.byteLength / MAX_CHUNK_SIZE);

			const encryptedChunks: ArrayBuffer[] = [];
			for (let i = 0; i < totalChunks; i++) {
				const start = i * MAX_CHUNK_SIZE;
				const end = Math.min(start + MAX_CHUNK_SIZE, data.byteLength);
				const chunk = data.slice(start, end);

				const encryptedChunk = await crypto.subtle.encrypt(
					{
						iv: iv,
						name: 'AES-GCM'
					},
					aesKey,
					chunk
				);
				if (signal?.aborted) {
					return Result.Err(new Error('Operation aborted'));
				}
				encryptedChunks.push(encryptedChunk);
			}

			const header = new Uint8Array(
				CHUNKED_TAG.byteLength + iv.byteLength + CHUNK_COUNT_BYTE_LENGTH
			);
			header.set(CHUNKED_TAG, 0);
			header.set(iv, CHUNKED_TAG.byteLength);

			const chunkCountView = new DataView(
				header.buffer,
				CHUNKED_TAG.byteLength + iv.byteLength,
				CHUNK_COUNT_BYTE_LENGTH
			);
			chunkCountView.setUint32(0, totalChunks, false);

			let totalSize = header.byteLength;
			for (const chunk of encryptedChunks) {
				totalSize += chunk.byteLength;
			}

			const resultBuffer = new Uint8Array(totalSize);
			resultBuffer.set(header, 0);

			let offset = header.byteLength;
			for (const chunk of encryptedChunks) {
				const chunkArray = new Uint8Array(chunk);
				resultBuffer.set(chunkArray, offset);
				offset += chunk.byteLength;
			}

			return Result.Ok(bufToBase64(resultBuffer));
		},
		(e) => new Error(`Error encrypting multi chunk`, { cause: e })
	);

const decryptDataWithKey = (
	encryptedData: string,
	aesKey: CryptoKey,
	signal?: AbortSignal
): AsyncResult<string, Error> =>
	AsyncResult.from(
		async function () {
			const encryptedDataBuff = base64ToBuf(encryptedData);
			const dataStart = decoder.decode(
				encryptedDataBuff.slice(0, Math.max(CHUNKED_TAG.byteLength, SINGLE_TAG.byteLength))
			);

			if (dataStart.startsWith(CHUNKED_TAG_STR)) {
				return decryptMultiChunk(encryptedDataBuff, aesKey, signal);
			} else if (dataStart.startsWith(SINGLE_TAG_STR)) {
				return decryptSingleChunk(encryptedDataBuff, aesKey, signal);
			} else {
				const taggedBuffer = new Uint8Array(SINGLE_TAG.byteLength + encryptedDataBuff.byteLength);
				taggedBuffer.set(SINGLE_TAG, 0);
				taggedBuffer.set(encryptedDataBuff, SINGLE_TAG.byteLength);
				return decryptSingleChunk(taggedBuffer, aesKey, signal);
			}
		},
		(e) => new Error(`Error decrypting data`, { cause: e })
	);

const decryptSingleChunk = (
	data: Uint8Array,
	aesKey: CryptoKey,
	signal?: AbortSignal
): AsyncResult<string, Error> =>
	AsyncResult.from(
		async function () {
			const iv = data.slice(SINGLE_TAG.byteLength, SINGLE_TAG.byteLength + IV_BYTE_LENGTH);
			const encryptedContent = data.slice(SINGLE_TAG.byteLength + IV_BYTE_LENGTH);

			const decryptedContent = await crypto.subtle.decrypt(
				{
					iv: iv,
					name: 'AES-GCM'
				},
				aesKey,
				encryptedContent
			);

			if (signal?.aborted) {
				return Result.Err(new Error('Operation aborted'));
			}
			return Result.Ok(decoder.decode(decryptedContent));
		},
		(e) => new Error(`Error decrypting single chunk`, { cause: e })
	);

const decryptMultiChunk = (
	data: Uint8Array,
	aesKey: CryptoKey,
	signal?: AbortSignal
): AsyncResult<string, Error> =>
	AsyncResult.from(
		async function () {
			const iv = data.slice(CHUNKED_TAG.byteLength, CHUNKED_TAG.byteLength + IV_BYTE_LENGTH);
			const chunkCountView = new DataView(
				data.buffer,
				CHUNKED_TAG.byteLength + IV_BYTE_LENGTH,
				CHUNK_COUNT_BYTE_LENGTH
			);
			const totalChunks = chunkCountView.getUint32(0, false);

			let offset = CHUNKED_TAG.byteLength + IV_BYTE_LENGTH + CHUNK_COUNT_BYTE_LENGTH;
			const decryptedChunks: ArrayBuffer[] = [];

			for (let i = 0; i < totalChunks; i++) {
				const chunkSize = Math.min(MAX_CHUNK_SIZE, data.byteLength - offset);
				const chunk = data.slice(offset, offset + chunkSize);

				offset += chunkSize;

				const decryptedChunk = await crypto.subtle.decrypt(
					{
						iv: iv,
						name: 'AES-GCM'
					},
					aesKey,
					chunk
				);
				if (signal?.aborted) {
					return Result.Err(new Error('Operation aborted'));
				}
				decryptedChunks.push(decryptedChunk);
			}

			let totalSize = 0;
			for (const chunk of decryptedChunks) {
				totalSize += chunk.byteLength;
			}

			const combinedBuffer = new Uint8Array(totalSize);
			let writeOffset = 0;

			for (const chunk of decryptedChunks) {
				const chunkArray = new Uint8Array(chunk);
				combinedBuffer.set(chunkArray, writeOffset);
				writeOffset += chunk.byteLength;
			}

			return Result.Ok(decoder.decode(combinedBuffer));
		},
		(e) => new Error(`Error decrypting multi chunk`, { cause: e })
	);

export function base64ToBuf(b64: string): Uint8Array {
	const binary = atob(b64);
	const arr = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		arr[i] = binary.charCodeAt(i);
	}
	return arr;
}

export function bufToBase64(buf: Uint8Array): string {
	const arr = Uint16Array.from(buf);
	const binary = new TextDecoder('UTF-16').decode(arr);
	return btoa(binary);
}

export { decryptDataWithKey, encryptDataWithKey };
