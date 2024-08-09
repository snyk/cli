import { Readable } from 'stream';

export class ConcatStream extends Readable {
  private current: Readable | undefined;
  private queue: Readable[] = [];

  constructor(...streams: Readable[]) {
    super({ objectMode: false }); // Adjust objectMode if needed
    this.queue.push(...streams);
  }

  append(...streams: Readable[]): void {
    this.queue.push(...streams);
    if (!this.current) {
      this._read();
    }
  }

  _read(size?: number): void {
    if (this.current) {
      return;
    }

    this.current = this.queue.shift();
    if (!this.current) {
      this.push(null);
      return;
    }

    this.current.on('data', (chunk) => this.push(chunk));
    this.current.on('end', () => {
      this.current = undefined;
      this._read(size);
    });
    this.current.on('error', (err) => this.emit('error', err));
  }
}
