import * as tap from 'tap';
import * as cli from '../../src/cli/commands';

const { test } = tap;

test("snyk help doesn't crash", async (t) => {
  t.match(await cli.help(), /Usage/);
});
