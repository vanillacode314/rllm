import { Option } from 'ts-result-option';

function parseSSEEventChunk(input: string): Option<Array<{ data: string; event: Option<string> }>> {
	const lines = input.split('\n');
	const events = [];
	let currentEvent = { data: '', event: Option.None<string>() };

	for (const line of lines) {
		if (line.startsWith(':')) continue;
		if (line.startsWith('data:')) {
			if (currentEvent.data === '') {
				currentEvent.data += line.slice(6);
			} else {
				currentEvent.data += '\n' + line.slice(6);
			}
		} else if (line.startsWith('event:')) {
			currentEvent.event = Option.Some(line.slice(7));
		} else if (line === '') {
			if (currentEvent.data !== '') {
				events.push(currentEvent);
				currentEvent = { data: '', event: Option.None<string>() };
			}
		}
	}

	if (currentEvent.data !== '') {
		events.push(currentEvent);
	}

	return events.length > 0 ? Option.Some(events) : Option.None();
}

export { parseSSEEventChunk };
