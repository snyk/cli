import { test } from 'tap';
import { abridgeErrorMessage } from '../src/lib/error-format';

test('abridge empty string', async (t) => {
  t.equal(abridgeErrorMessage('', 10), '');
});

test('abridge shorter than max length', async (t) => {
  t.equal(abridgeErrorMessage('hello', 10), 'hello');
});

test('abridge same length as max length', async (t) => {
  t.equal(abridgeErrorMessage('hello', 5), 'hello');
});

test('abridge longer than max length', async (t) => {
  t.equal(abridgeErrorMessage('hello there', 10), 'he ... re');
});

test('abridge longer than max length (custom ellipsis)', async (t) => {
  t.equal(abridgeErrorMessage('hello there', 10, '--'), 'hell--here');
});

test('abridge is not longer than max length', async (t) => {
  const maxLength = 10;
  t.true(abridgeErrorMessage('hello there', maxLength).length < maxLength);
});
