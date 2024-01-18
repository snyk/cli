import * as _ from 'lodash';
import debug = require('debug');
import { Transform, Writable } from 'stream';

interface IStreams {
  destination: Writable;
  data: unknown;
  setWriteData<T>(data: T): IStreams
  write(): void
}


export class Streams implements IStreams {
  destination: Writable;
  data: unknown;

  constructor(stream: Writable) {
    this.destination = stream;
  }

  setWriteData<T>(data: T): Streams {
    this.data = data;
    return this;
  }

  write() {
    if (_.isUndefined(this.data)) {
      debug('No data to stream');
      return;
    }

    try {
      const jsonStream = new Transform({
        objectMode: true,
        transform(chunk: unknown, encoding: string, callback: (error: Error | null, data: any) => void) {
          const jsonChunk = JSON.stringify(chunk, null, 2) + '\n';
          callback(null, jsonChunk);
        }
      });

      jsonStream.read()
      jsonStream.pipe(this.destination);
      jsonStream.write(this.data);
      jsonStream.end();

      jsonStream.on('finish', () => {
        return;
      })
      jsonStream.on('error', (err) => {
        console.error('Error while writing data: ', err);
        return;
      });
    } catch (error) {
      console.error(`Error writing data: ${error}`);
    }
  }
}
