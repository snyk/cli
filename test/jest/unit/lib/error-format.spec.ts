import { abridgeErrorMessage } from '../../../../src/lib/error-format';

test('abridge empty string', async () => {
  expect(abridgeErrorMessage('', 10)).toEqual('');
});

test('abridge shorter than max length', async () => {
  expect(abridgeErrorMessage('hello', 10)).toEqual('hello');
});

test('abridge same length as max length', async () => {
  expect(abridgeErrorMessage('hello', 5)).toEqual('hello');
});

test('abridge longer than max length', async () => {
  expect(abridgeErrorMessage('hello there', 10)).toEqual('he ... re');
});

test('abridge longer than max length (custom ellipsis)', async () => {
  expect(abridgeErrorMessage('hello there', 10, '--')).toEqual('hell--here');
});

test('abridge is not longer than max length', async () => {
  expect(abridgeErrorMessage('hello there', 10).length).toBeLessThan(10);
});
