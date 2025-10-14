import { AsyncResult } from '~/async-result';

function safeFetch(
	url: string,
	config: RequestInit & { fetcher?: (url: string, config: RequestInit) => Promise<Response> } = {}
): AsyncResult<Response, Error> {
	const fetcher = AsyncResult.wrap(config.fetcher ?? fetch, (e) =>
		e instanceof Error ? e : new Error(`Failed to fetch ${url}`, { cause: e })
	);
	return fetcher(url, config);
}

export { safeFetch };
