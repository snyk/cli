import { test } from 'tap';
import * as snyk from '../../src/lib';

test('does it load', async (t) => {
  t.assert(snyk, 'snyk loaded');
});
