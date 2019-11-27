import * as sinon from 'sinon';
import { AcceptanceTests } from './cli-test.acceptance.test';

import * as _ from 'lodash';

export const SbtTests: AcceptanceTests = {
  language: 'SBT',
  tests: {
    '`test sbt-simple-struts`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      const plugin = {
        async inspect() {
          return {
            plugin: { name: 'sbt' },
            package: require('../workspaces/sbt-simple-struts/dep-tree.json'),
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      loadPlugin.returns(plugin);

      t.teardown(() => {
        loadPlugin.restore();
      });

      params.server.setNextResponse(
        require('../workspaces/sbt-simple-struts/test-graph-result.json'),
      );

      try {
        await params.cli.test('sbt-simple-struts', { json: true });

        t.fail('should have thrown');
      } catch (err) {
        const res = JSON.parse(err.message);

        const expected = require('../workspaces/sbt-simple-struts/legacy-res-json.json');

        t.deepEqual(
          _.omit(res, ['vulnerabilities', 'packageManager']),
          _.omit(expected, ['vulnerabilities', 'packageManager']),
          'metadata is ok',
        );
        // NOTE: decided to keep this discrepancy
        t.is(
          res.packageManager,
          'sbt',
          'pacakgeManager is sbt, altough it was mavn with the legacy api',
        );
        t.deepEqual(
          _.sortBy(res.vulnerabilities, 'id'),
          _.sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },
  },
};
