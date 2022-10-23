import * as sinon from 'sinon';
import { AcceptanceTests } from '../cli-test.acceptance.test';
import { getWorkspacePath } from '../../jest/util/getWorkspacePath';

const omit = require('lodash.omit');
const sortBy = require('lodash.sortby');

export const SbtTests: AcceptanceTests = {
  language: 'SBT',
  tests: {
    '`test sbt-simple-struts`': (params, utils) => async (t) => {
      utils.chdirWorkspaces();

      const plugin = {
        async inspect() {
          return {
            plugin: { name: 'sbt' },
            package: require(getWorkspacePath(
              'sbt-simple-struts/dep-tree.json',
            )),
          };
        },
      };
      const loadPlugin = sinon.stub(params.plugins, 'loadPlugin');
      loadPlugin.returns(plugin);

      t.teardown(() => {
        loadPlugin.restore();
      });

      params.server.setNextResponse(
        require(getWorkspacePath('sbt-simple-struts/test-graph-result.json')),
      );

      try {
        await params.cli.test('sbt-simple-struts', { json: true });

        t.fail('should have thrown');
      } catch (err) {
        const res = JSON.parse(err.message);

        const expected = require(getWorkspacePath(
          'sbt-simple-struts/legacy-res-json.json',
        ));

        t.deepEqual(
          omit(res, ['vulnerabilities', 'packageManager']),
          omit(expected, ['vulnerabilities', 'packageManager']),
          'metadata is ok',
        );
        // NOTE: decided to keep this discrepancy
        t.is(
          res.packageManager,
          'sbt',
          'pacakgeManager is sbt, although it was mavn with the legacy api',
        );
        t.deepEqual(
          sortBy(res.vulnerabilities, 'id'),
          sortBy(expected.vulnerabilities, 'id'),
          'vulns are the same',
        );
      }
    },
  },
};
