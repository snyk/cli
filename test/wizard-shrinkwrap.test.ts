import fs from 'fs';
import { test } from 'tap';
import path from 'path';
import tryRequire from 'snyk-try-require';

import interactive = require('./wizard-instrumented');

test('wizard detects shrinkwrap and includes shrinkwrap when updating', async (t) => {
  const responses = [
    'default:update', // 7
    'default:update', // 3
    'default:update', // 1
    'default:update', // 5
    'default:update', // 1
    'default:update', // 2
    'default:patch', // 2
    'default:patch', // 1
    'default:patch', // 1
    'default:patch', // 2
  ];

  try {
    const vulns = JSON.parse(
      fs.readFileSync(path.resolve(__dirname, './fixtures/mean.json'), 'utf-8'),
    );

    const pkg = await tryRequire(
      path.resolve(__dirname, './fixtures/pkg-mean-io/package.json'),
    );

    const options = { pkg };

    const res = await interactive(vulns, responses, options);
    t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
  } catch (e) {
    t.threw(e);
  }
});
