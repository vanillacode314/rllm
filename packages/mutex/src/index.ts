export class Mutex {
  queue = new Array<() => void>();

  constructor(private locked = false) {}

  async lock() {
    if (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.locked = true;
  }

  unlock() {
    this.locked = false;

    if (this.queue.length > 0) {
      const resolve = this.queue.shift()!;
      resolve();
    }
  }
}
