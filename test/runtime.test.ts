import { test } from 'tap';
import * as runtime from '../src/cli/runtime';

test('nodejs runtime versions support ', async (t) => {
  t.ok(
    runtime.isSupported(process.versions.node),
    'Current runtime is supported',
  );
  t.notOk(runtime.isSupported('6.16.0'), '6.16.0 is not supported');
  t.ok(runtime.isSupported('8.0.0'), '8.0.0 is supported');
  t.ok(runtime.isSupported('11.0.0-pre'), 'pre-release is supported');
  t.notOk(runtime.isSupported('0.10.48'), '0.10 is not supported');
  t.notOk(runtime.isSupported('0.12.18'), '0.12 is not supported');
  t.notOk(runtime.isSupported('4.0.0'), '4.0.0 is not supported');
  t.notOk(runtime.isSupported('6.4.0'), '6.4.0 is not supported');
});
