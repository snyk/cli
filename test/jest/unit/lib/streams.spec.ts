import * as stream from 'stream';
import { Streams } from '../../../../src/lib/streams';

jest.mock('stream');

describe('Streams', () => {
  it('should handle large data objects and write them to stdout', async () => {
    const mockStdout = new stream.Writable();
    const streams = new Streams(mockStdout);

    // ~64MB object
    const largeData = new Array(64 * 1024 * 1024).fill({});

    streams.setWriteData<any[]>(largeData);

    // write() is not async, but it uses the stream lib which performs tasks asynchronously
    // so we want to ensure write() completes asynchronously by awaiting
    await streams.write();

    expect(mockStdout.write).toHaveBeenCalledTimes(largeData.length);
    expect(mockStdout.end).toHaveBeenCalledTimes(1);
  });
});
