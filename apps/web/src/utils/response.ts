import { Option } from 'ts-result-option';

interface SSEEvent {
	data: string;
	event: Option<string>;
}

function makeSSEParser() {
	let buffer = '';
	return {
		feed(chunk: string): Array<SSEEvent> {
			const normalized = chunk.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
			buffer += normalized;
			const result = parseSSEEventChunk(buffer);
			const lastNewlineIndex = buffer.lastIndexOf('\n\n');
			if (lastNewlineIndex !== -1) {
				buffer = buffer.slice(lastNewlineIndex + 1);
			}
			return result.unwrapOr([]);
		},
		flush(): Array<SSEEvent> {
			const result = parseSSEEventChunk(buffer);
			buffer = '';
			return result.unwrapOr([]);
		},
		getBuffer(): string {
			return buffer;
		}
	};
}

function parseSSEEventChunk(input: string): Option<Array<SSEEvent>> {
	const normalized = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');
	const events: SSEEvent[] = [];
	let currentEvent: SSEEvent = { data: '', event: Option.None<string>() };

	for (const line of lines) {
		const trimmedLine = line.trim();
		const isCommentLine = trimmedLine.startsWith(':');
		const isDataLine = trimmedLine.startsWith('data:');
		const isEventLine = trimmedLine.startsWith('event:');
		if (isCommentLine) continue;

		if (isDataLine) {
			const dataContent = trimmedLine.slice(5).trimStart();
			if (dataContent === '') continue;
			if (currentEvent.data === '') {
				currentEvent.data = dataContent;
			} else {
				currentEvent.data += '\n' + dataContent;
			}
		} else if (isEventLine) {
			const eventName = trimmedLine.slice(6).trim();
			if (eventName !== '') {
				currentEvent.event = Option.Some(eventName);
			}
		} else if (currentEvent.data !== '') {
			events.push(currentEvent);
			currentEvent = { data: '', event: Option.None<string>() };
		}
	}

	return events.length > 0 ? Option.Some(events) : Option.None();
}

export { makeSSEParser, parseSSEEventChunk };
