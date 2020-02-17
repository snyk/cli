import * as path from 'path';
import { test } from 'tap';
import * as snyk from '../src/lib';

// this test checks we're collecting the *local* installed version *not* the
// version that's stated in the package. i.e. handlebars@~2.0.0-alpha.2 is not
// valid, because it's a range (a suggestion as to which version to use) but
// handlebars@2.0.0-alpha.2 *is* right
test('version gleaned is installed version, not package dep version', async (t) => {
  const dir = path.resolve(__dirname, 'fixtures', 'hbs-demo');
  const modules = await snyk.modules(dir);
  t.equal(modules.dependencies.handlebars.full, 'handlebars@2.0.0');
});
