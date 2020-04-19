import { test } from 'tap';

import {
  formatReachability,
  getReachabilityText,
} from '../src/cli/commands/test/formatters/format-reachability';
import { REACHABILITY } from '../src/lib/snyk-test/legacy';

test('output formatting', (t) => {
  t.equal(
    formatReachability(REACHABILITY.FUNCTION),
    '[Reachable by function call]',
  );
  t.equal(
    formatReachability(REACHABILITY.PACKAGE),
    '[Reachable by package import]',
  );
  t.equal(formatReachability(REACHABILITY.UNREACHABLE), '[Unreachable]');
  t.equal(formatReachability(REACHABILITY.NO_INFO), '');
  t.equal(formatReachability(undefined), '');
  t.end();
});

test('reachable text', (t) => {
  t.equal(
    getReachabilityText(REACHABILITY.FUNCTION),
    'Reachable by function call',
  );
  t.equal(
    getReachabilityText(REACHABILITY.PACKAGE),
    'Reachable by package import',
  );
  t.equal(getReachabilityText(REACHABILITY.UNREACHABLE), 'Unreachable');
  t.equal(getReachabilityText(REACHABILITY.NO_INFO), '');
  t.equal(getReachabilityText(undefined), '');
  t.end();
});
