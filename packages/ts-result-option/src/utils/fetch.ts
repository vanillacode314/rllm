import { AsyncResult } from '~/async-result';

function safeFetch(
	url: string,
	config: RequestInit & { fetcher?: (url: string, config: RequestInit) => Promise<Response> } = {}
): AsyncResult<Response, Error> {
	const { fetcher = fetch } = config;
	return AsyncResult.fromPromise(
		() => fetcher(url, config),
		(e) => (e instanceof Error ? e : new Error(`Failed to fetch ${url}`, { cause: e }))
	);
}

export { safeFetch };
