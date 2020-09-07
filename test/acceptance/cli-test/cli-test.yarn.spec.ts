import { AcceptanceTests } from './cli-test.acceptance.test';

export const YarnTests: AcceptanceTests = {
  language: 'Yarn',
  tests: {
    // yarn lockfile based testing is only supported for node 4+
    '`test yarn-out-of-sync` out of sync fails': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces();
      try {
        await params.cli.test('yarn-out-of-sync', { dev: true });
        t.fail('Should fail');
      } catch (e) {
        t.equal(
          e.message,
          '\nTesting yarn-out-of-sync...\n\n' +
            'Dependency snyk was not found in yarn.lock.' +
            ' Your package.json and yarn.lock are probably out of sync.' +
            ' Please run "yarn install" and try again.',
          'Contains enough info about err',
        );
      }
    },

    '`test yarn-out-of-sync --strict-out-of-sync=false` passes': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-out-of-sync', {
        dev: true,
        strictOutOfSync: false,
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'acorn-jsx@3.0.1',
          'acorn@3.3.0',
          'acorn@5.7.3',
          'ajv-keywords@2.1.1',
          'ajv@5.5.2',
          'ansi-escapes@3.1.0',
          'ansi-regex@2.1.1',
          'ansi-regex@3.0.0',
          'ansi-styles@2.2.1',
          'ansi-styles@3.2.1',
          'argparse@1.0.10',
          'array-union@1.0.2',
          'array-uniq@1.0.3',
          'arrify@1.0.1',
          'babel-code-frame@6.26.0',
          'balanced-match@1.0.0',
          'brace-expansion@1.1.11',
          'buffer-from@1.1.1',
          'caller-path@0.1.0',
          'callsites@0.2.0',
          'chalk@1.1.3',
          'chalk@2.4.1',
          'chardet@0.4.2',
          'circular-json@0.3.3',
          'cli-cursor@2.1.0',
          'cli-width@2.2.0',
          'co@4.6.0',
          'color-convert@1.9.3',
          'color-name@1.1.3',
          'concat-map@0.0.1',
          'concat-stream@1.6.2',
          'core-util-is@1.0.2',
          'cross-spawn@5.1.0',
          'debug@3.2.5',
          'deep-is@0.1.3',
          'del@2.2.2',
          'doctrine@2.1.0',
          'escape-string-regexp@1.0.5',
          'eslint-scope@3.7.3',
          'eslint-visitor-keys@1.0.0',
          'eslint@4.19.1',
          'espree@3.5.4',
          'esprima@4.0.1',
          'esquery@1.0.1',
          'esrecurse@4.2.1',
          'estraverse@4.2.0',
          'esutils@2.0.2',
          'external-editor@2.2.0',
          'fast-deep-equal@1.1.0',
          'fast-json-stable-stringify@2.0.0',
          'fast-levenshtein@2.0.6',
          'figures@2.0.0',
          'file-entry-cache@2.0.0',
          'flat-cache@1.3.0',
          'fs.realpath@1.0.0',
          'functional-red-black-tree@1.0.1',
          'glob@7.1.3',
          'globals@11.7.0',
          'globby@5.0.0',
          'graceful-fs@4.1.11',
          'has-ansi@2.0.0',
          'has-flag@3.0.0',
          'iconv-lite@0.4.24',
          'ignore@3.3.10',
          'imurmurhash@0.1.4',
          'inflight@1.0.6',
          'inherits@2.0.3',
          'inquirer@3.3.0',
          'is-fullwidth-code-point@2.0.0',
          'is-path-cwd@1.0.0',
          'is-path-in-cwd@1.0.1',
          'is-path-inside@1.0.1',
          'is-promise@2.1.0',
          'is-resolvable@1.1.0',
          'isarray@1.0.0',
          'isexe@2.0.0',
          'js-tokens@3.0.2',
          'js-yaml@3.12.0',
          'json-schema-traverse@0.3.1',
          'json-stable-stringify-without-jsonify@1.0.1',
          'levn@0.3.0',
          'lodash@4.17.11',
          'lru-cache@4.1.3',
          'mimic-fn@1.2.0',
          'minimatch@3.0.4',
          'minimist@0.0.8',
          'mkdirp@0.5.1',
          'ms@2.1.1',
          'mute-stream@0.0.7',
          'natural-compare@1.4.0',
          'npm-package@1.0.0',
          'object-assign@4.1.1',
          'once@1.4.0',
          'onetime@2.0.1',
          'optionator@0.8.2',
          'os-tmpdir@1.0.2',
          'path-is-absolute@1.0.1',
          'path-is-inside@1.0.2',
          'pify@2.3.0',
          'pinkie-promise@2.0.1',
          'pinkie@2.0.4',
          'pluralize@7.0.0',
          'prelude-ls@1.1.2',
          'process-nextick-args@2.0.0',
          'progress@2.0.0',
          'pseudomap@1.0.2',
          'readable-stream@2.3.6',
          'regexpp@1.1.0',
          'require-uncached@1.0.3',
          'resolve-from@1.0.1',
          'restore-cursor@2.0.0',
          'rewire@4.0.1',
          'rimraf@2.6.2',
          'run-async@2.3.0',
          'rx-lite-aggregates@4.0.8',
          'rx-lite@4.0.8',
          'safe-buffer@5.1.2',
          'safer-buffer@2.1.2',
          'semver@5.5.1',
          'shebang-command@1.2.0',
          'shebang-regex@1.0.0',
          'signal-exit@3.0.2',
          'slice-ansi@1.0.0',
          'snyk@*',
          'sprintf-js@1.0.3',
          'string-width@2.1.1',
          'string_decoder@1.1.1',
          'strip-ansi@3.0.1',
          'strip-ansi@4.0.0',
          'strip-json-comments@2.0.1',
          'supports-color@2.0.0',
          'supports-color@5.5.0',
          'table@4.0.2',
          'text-table@0.2.0',
          'through@2.3.8',
          'tmp@0.0.33',
          'to-array@0.1.4',
          'type-check@0.3.2',
          'typedarray@0.0.6',
          'util-deprecate@1.0.2',
          'which@1.3.1',
          'wordwrap@1.0.0',
          'wrappy@1.0.2',
          'write@0.2.1',
          'yallist@2.1.2',
        ].sort(),
        'depGraph looks fine',
      );
    },
    '`test yarn-package --file=yarn-package/yarn.lock ` sends pkg info & policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test({ file: 'yarn-package/yarn.lock' });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.policy, 'npm:debug:20170905', 'policy is found & sent');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },
    '`test yarn-package --file=yarn.lock ` sends pkg info & policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-package', { file: 'yarn.lock' });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.policy, 'npm:debug:20170905', 'policy is found & sent');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },
    '`test yarn-package` sends pkg info & policy': (params, utils) => async (
      t,
    ) => {
      utils.chdirWorkspaces('yarn-package');
      await params.cli.test();
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.policy, 'npm:debug:20170905', 'policy is found & sent');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['npm-package@1.0.0', 'ms@0.7.1', 'debug@2.2.0'].sort(),
        'depGraph looks fine',
      );
    },

    '`test yarn-package --file=yarn.lock --dev` sends pkg info': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-package', { file: 'yarn.lock', dev: true });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        [
          'npm-package@1.0.0',
          'ms@0.7.1',
          'debug@2.2.0',
          'object-assign@4.1.1',
        ].sort(),
        'depGraph looks fine',
      );
    },

    '`test yarn-package-with-subfolder --file=yarn.lock ` picks top-level files': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-package-with-subfolder', {
        file: 'yarn.lock',
      });
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['yarn-package-top-level@1.0.0', 'to-array@0.1.4'].sort(),
        'depGraph looks fine',
      );
    },

    '`test yarn-package-with-subfolder --file=subfolder/yarn.lock` picks subfolder files': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      await params.cli.test('yarn-package-with-subfolder', {
        file: 'subfolder/yarn.lock',
      });
      const req = params.server.popRequest();
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['yarn-package-subfolder@1.0.0', 'to-array@0.1.4'].sort(),
        'depGraph looks fine',
      );
    },

    '`test` on a yarn package does work and displays appropriate text': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces('yarn-app');
      await params.cli.test();
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.match(req.body.targetFile, undefined, 'target is undefined');
      const depGraph = req.body.depGraph;
      t.same(
        depGraph.pkgs.map((p) => p.id).sort(),
        ['yarn-app-one@1.0.0', 'marked@0.3.6', 'moment@2.18.1'].sort(),
        'depGraph looks fine',
      );
    },
    // '`test` on a yarn v2 package': (params, utils) => async (t) => {
    //   const nodeVersion = parseInt(process.version.slice(1).split('.')[0], 10);
    //
    //   if (nodeVersion < 10) {
    //     return t.skip();
    //   }
    //
    //   utils.chdirWorkspaces('yarn-v2');
    //   await params.cli.test();
    //   const req = params.server.popRequest();
    //   t.equal(req.method, 'POST', 'makes POST request');
    //   t.equal(
    //     req.headers['x-snyk-cli-version'],
    //     params.versionNumber,
    //     'sends version number',
    //   );
    //   t.match(req.url, '/test-dep-graph', 'posts to correct url');
    //   t.match(req.body.targetFile, undefined, 'target is undefined');
    //   const depGraph = req.body.depGraph;
    //   t.same(
    //     depGraph.pkgs.map((p) => p.id).sort(),
    //     ['yarn-v2@1.0.0', 'lodash@4.17.0'].sort(),
    //     'depGraph looks fine',
    //   );
    // },
  },
};
