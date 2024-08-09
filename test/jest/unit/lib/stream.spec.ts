import { Readable, Writable } from 'stream';

import { ConcatStream } from '../../../../src/lib/stream';

describe('ConcatStream', () => {
  it('should create a readable stream', () => {
    const stream = new ConcatStream();

    expect(stream).toBeInstanceOf(Readable);
  });

  it('should concatenate readable streams', async () => {
    const stream = new ConcatStream();
    const chunks = jest.fn();
    const out = new Writable({
      write: (chunk, enc, done) => {
        chunks(chunk.toString());
        done();
      },
    });

    stream.append(Readable.from('foo'), Readable.from('bar'));

    await new Promise((res) => {
      stream.pipe(out).on('finish', res);
    });

    expect(chunks).toHaveBeenCalledWith('foo');
    expect(chunks).toHaveBeenCalledWith('bar');
  });
});
