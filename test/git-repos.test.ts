import * as cli from '../src/cli/commands/';
import { test } from 'tap';

const urls = [
  // a repo with no dependencies so it will never be vulnerable (2017-05-15)
  'https://github.com/Snyk/vulndb-fixtures',
  'https://github.com/Snyk/vulndb-fixtures.git',
  'git@github.com:Snyk/vulndb-fixtures.git',
  'Snyk/vulndb-fixtures.git',
];

test('snyk test supports different URLs', async (t) => {
  try {
    for (const url of urls) {
      const res = await cli.test(url);
      t.ok(res, `snyk test ${url} ok`);
    }
  } catch (err) {
    t.fail('unexpected error thrown: ' + err.message);
  }
});
