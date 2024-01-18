import { Streams } from '../../../../src/lib/streams';

describe('Streams', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('should handle output to stdout', async () => {
    let actualOutput = '';
    const stdOutSpy = jest
    .spyOn(process.stdout, "write")
    .mockImplementation((output) => {
      actualOutput = output as string;
      return true;
    });
    
    const streams = new Streams(process.stdout);
    streams.setWriteData('hello world').write();
    
    expect(stdOutSpy).toBeCalledTimes(1);
    expect(actualOutput).toContain('hello world');
  });
});
