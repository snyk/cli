import { Transform, Writable } from 'stream';
import * as _ from 'lodash';

interface IStreams {
  stream: Writable;
  data: unknown;
  setWriteData<T>(data: T): IStreams
  write(data: unknown): void
}

export class Streams implements IStreams {
  stream: Writable;
  data: unknown;

  constructor(stream: Writable) {
    this.stream = stream;
  }

  setWriteData<T>(data: T): Streams {
    this.data = data;
    return this;
  }

  write() {
    if (_.isEmpty(this.data)) {
      console.log('No data to stream');
      return;
    }

    try {
      const jsonStream = new Transform({
        objectMode: true,
        transform(chunk: Record<string, unknown>, encoding: string, callback: (error: Error | null, data: any) => void) {
          const jsonChunk = JSON.stringify(chunk, null, 2) + '\n';
          callback(null, jsonChunk);
        }
      });

      jsonStream.pipe(this.stream);
      jsonStream.write(this.data);
      jsonStream.end();

      this.stream.on('finish', () => {
        return;
      });

      this.stream.on('error', (err) => {
        console.error(err);
        return;
      });

    } catch (error) {
      console.error(`Error writing to file: ${error.message}`);
    }
  }
}
