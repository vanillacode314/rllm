type EventConstructorOptions = {
  once?: boolean;
};

export class Event<TPayload> {
  #emitted = false;
  #once = false;

  #subscribers = new Set<(payload: TPayload) => void>();
  constructor(options: EventConstructorOptions = {}) {
    this.#once = Boolean(options.once);
  }

  emit(payload: TPayload) {
    if (this.#once) {
      if (this.#emitted) return;
      this.#subscribers.clear();
    }
    this.#emitted = true;
    for (const subscriber of this.#subscribers) {
      subscriber(payload);
    }
  }

  subscribe(subscriber: (payload: TPayload) => void) {
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }
}

export function makeEvent<T>(options: EventConstructorOptions = {}) {
  const event = new Event<T>(options);
  return [event.subscribe.bind(event), event.emit.bind(event)];
}
