import { jsonStringifyLargeObject } from '../../../src/lib/json';

describe('jsonStringifyLargeObject', () => {
  it('works normally with a small object', () => {
    const smallObject = {
      name: 'Mozart',
      isGoodBoy: true,
    };
    const s = jsonStringifyLargeObject(smallObject);
    expect(s).toEqual('{\n  "name": "Mozart",\n  "isGoodBoy": true\n}');
  });

  it('fallsback on non-pretty-print on very large object', () => {
    const largeObject = {
      name: 'Brian',
      isGoodBoy: true,
      type: 'big',
    };
    const jsonStringifyMock = jest
      .spyOn(JSON, 'stringify')
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .mockImplementationOnce((any) => {
        throw new Error('fake error to simulate an `Invalid string length`');
      });

    const s = jsonStringifyLargeObject(largeObject);
    expect(jsonStringifyMock).toHaveBeenCalledTimes(2);
    expect(s).toEqual(`{"name":"Brian","isGoodBoy":true,"type":"big"}`);
  });
});
