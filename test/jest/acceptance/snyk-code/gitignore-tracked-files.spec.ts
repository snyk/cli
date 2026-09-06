// The SCLE setting routes code-client-go at a fake deeproxy server, so the `POST /bundle`
// body is the exact set of files that survived the filter.
import { runSnykCLI } from '../../util/runSnykCLI';
import { runCommand } from '../../util/runCommand';
import { fakeServer } from '../../../acceptance/fake-server';
import { fakeDeepCodeServer } from '../../../acceptance/deepcode-fake-server';
import { getServerPort } from '../../util/getServerPort';
import * as fs from 'fs';
import * as os from 'os';
import { dirname, join } from 'path';

jest.setTimeout(1000 * 120);

// GAF binds config keys to upper-cased env vars, bypassing the remote flag.
const TRACKED_FILES_FLAG_ENV =
  'INTERNAL_SNYK_GITIGNORE_RESPECT_TRACKED_FILES_ENABLED';

const EXIT_CODE_SUCCESS = 0;
const EXIT_CODE_NO_SUPPORTED_FILES = 3;

type Files = Record<string, string>;

interface FilterCase {
  name: string;
  files: Files;
  /** Staged with `git add -f`, so gitignored paths are tracked too. */
  tracked?: string[];
  /** `git rm --cached` after staging, i.e. tracked then untracked again. */
  untrack?: string[];
  /** Deleted from disk after staging, so they remain in the index only. */
  deleteFromWorktree?: string[];
  noGitRepo?: boolean;
  scanSubdir?: string;
  expectedOff: string[];
  expectedOn: string[];
}

// Never ignored, never tracked: proves the scan reached the upload step.
const CONTROL_FILE = 'control.js';

const cases: FilterCase[] = [
  // --- baselines ---
  {
    name: 'no ignore files: everything is scanned',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      'tracked.js': 'const a = 1;\n',
      'untracked.js': 'const b = 2;\n',
    },
    tracked: ['tracked.js'],
    expectedOff: [CONTROL_FILE, 'tracked.js', 'untracked.js'],
    expectedOn: [CONTROL_FILE, 'tracked.js', 'untracked.js'],
  },
  {
    name: 'an untracked file matching .gitignore is excluded in both flag states',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'untracked.js\n',
      'untracked.js': 'const b = 2;\n',
    },
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'a .gitignore rule matching nothing changes nothing',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'nothing-matches-this\n',
      'tracked.js': 'const a = 1;\n',
    },
    tracked: ['tracked.js'],
    expectedOff: [CONTROL_FILE, 'tracked.js'],
    expectedOn: [CONTROL_FILE, 'tracked.js'],
  },
  {
    name: 'a .gitignore with only comments and blank lines changes nothing',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': '# a comment\n\n   \n',
      'tracked.js': 'const a = 1;\n',
    },
    tracked: ['tracked.js'],
    expectedOff: [CONTROL_FILE, 'tracked.js'],
    expectedOn: [CONTROL_FILE, 'tracked.js'],
  },

  // --- the core behaviour ---
  {
    name: 'CORE: a tracked file matching .gitignore is scanned only with the flag on',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': '*.log.js\n',
      'secret.log.js': 'const a = 1;\n',
      'other.log.js': 'const b = 2;\n',
    },
    tracked: ['secret.log.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE, 'secret.log.js'],
  },
  {
    name: 'CORE: a tracked file inside a .gitignore-excluded directory is scanned with the flag on',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'build/\n',
      'build/tracked.js': 'const a = 1;\n',
      'build/untracked.js': 'const b = 2;\n',
    },
    tracked: ['build/tracked.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE, 'build/tracked.js'],
  },
  {
    name: 'CORE: a tracked file deep in a subdirectory is scanned with the flag on',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': '*.gen.js\n',
      'src/nested/deep/a.gen.js': 'const a = 1;\n',
      'src/nested/deep/b.gen.js': 'const b = 2;\n',
    },
    tracked: ['src/nested/deep/a.gen.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE, 'src/nested/deep/a.gen.js'],
  },
  {
    name: 'CORE: a rule from a nested .gitignore also honours tracked files',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      'src/.gitignore': 'generated.js\n',
      'src/generated.js': 'const a = 1;\n',
      'src/other.js': 'const b = 2;\n',
    },
    tracked: ['src/generated.js'],
    expectedOff: [CONTROL_FILE, 'src/other.js'],
    expectedOn: [CONTROL_FILE, 'src/generated.js', 'src/other.js'],
  },
  {
    name: 'CORE: a file staged but never committed counts as tracked',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'staged.js\n',
      'staged.js': 'const a = 1;\n',
    },
    tracked: ['staged.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE, 'staged.js'],
  },

  // --- user-provided Snyk exclusions must win ---
  {
    name: 'USER RULES: a .snyk exclusion still applies to a tracked, gitignored file',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'secret.js\n',
      '.snyk': 'exclude:\n  global:\n    - secret.js\n',
      'secret.js': 'const a = 1;\n',
    },
    tracked: ['secret.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'USER RULES: a .snyk exclusion still applies to a tracked file no .gitignore rule matches',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.snyk': 'exclude:\n  global:\n    - secret.js\n',
      'secret.js': 'const a = 1;\n',
    },
    tracked: ['secret.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'USER RULES: a .dcignore rule still applies to a tracked file — only git un-ignores tracked files',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.dcignore': 'vendored.js\n',
      'vendored.js': 'const a = 1;\n',
    },
    tracked: ['vendored.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'USER RULES: a .dcignore rule wins over .gitignore tracking for the same file',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'vendored.js\n',
      '.dcignore': 'vendored.js\n',
      'vendored.js': 'const a = 1;\n',
    },
    tracked: ['vendored.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },

  // --- negation semantics ---
  {
    name: 'NEGATION: a negation inside .gitignore is honoured regardless of tracking',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'gen/*.js\n!gen/keep.js\n',
      'gen/keep.js': 'const a = 1;\n',
      'gen/drop.js': 'const b = 2;\n',
    },
    expectedOff: [CONTROL_FILE, 'gen/keep.js'],
    expectedOn: [CONTROL_FILE, 'gen/keep.js'],
  },
  {
    name: 'NEGATION: the flag must not change the outcome for an untracked file negated across ignore sources',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.dcignore': 'gen/*.js\n',
      '.gitignore': '!gen/keep.js\n',
      'gen/keep.js': 'const a = 1;\n',
      'gen/drop.js': 'const b = 2;\n',
    },
    // Nothing is tracked, so the flag must not change this.
    expectedOff: [CONTROL_FILE, 'gen/keep.js'],
    expectedOn: [CONTROL_FILE, 'gen/keep.js'],
  },

  // --- git edge cases ---
  {
    name: 'GIT: outside a git repository the legacy behaviour is kept',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'ignored.js\n',
      'ignored.js': 'const a = 1;\n',
    },
    noGitRepo: true,
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'GIT: a file removed from the index is untracked again and stays excluded',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'removed.js\n',
      'removed.js': 'const a = 1;\n',
    },
    tracked: ['removed.js'],
    untrack: ['removed.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'GIT: a tracked file missing from the working tree does not break the scan',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': 'gone.js\n',
      'gone.js': 'const a = 1;\n',
    },
    tracked: ['gone.js'],
    deleteFromWorktree: ['gone.js'],
    expectedOff: [CONTROL_FILE],
    expectedOn: [CONTROL_FILE],
  },
  {
    name: 'GIT: scanning a subdirectory resolves tracked files relative to that subdirectory',
    // GetAllFiles only walks the scan root, so the .gitignore must live inside src/.
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      'src/.gitignore': '*.gen.js\n',
      'src/inside.gen.js': 'const a = 1;\n',
      'src/control.js': 'const d = 3;\n',
      'src/other.gen.js': 'const e = 4;\n',
      'outside.gen.js': 'const b = 2;\n',
    },
    tracked: ['src/inside.gen.js', 'outside.gen.js'],
    scanSubdir: 'src',
    expectedOff: ['control.js'],
    expectedOn: ['control.js', 'inside.gen.js'],
  },
  {
    // Pins a pre-existing leak, unaffected by the flag: `!.git/**` negates the built-in
    // `**/.git/**` default, so repository internals are scanned. Tracked separately.
    name: 'GIT: a .gitignore negation of .git/** leaks repository internals',
    files: {
      [CONTROL_FILE]: 'const c = 0;\n',
      '.gitignore': '!.git/**\n',
    },
    expectedOff: [CONTROL_FILE, '.git/planted.js'],
    expectedOn: [CONTROL_FILE, '.git/planted.js'],
  },
];

describe('snyk code test — gitignore / tracked-file filtering', () => {
  let server: ReturnType<typeof fakeServer>;
  let deepCodeServer: ReturnType<typeof fakeDeepCodeServer>;
  let baseEnv: Record<string, string>;
  const port = getServerPort(process);
  const baseApi = '/api/v1';

  beforeAll(async () => {
    deepCodeServer = fakeDeepCodeServer();
    await new Promise<void>((resolve) =>
      deepCodeServer.listen(() => resolve()),
    );
    server = fakeServer(baseApi, 'snykToken');
    await new Promise<void>((resolve) => server.listen(port, () => resolve()));

    baseEnv = {
      ...process.env,
      SNYK_API: `http://localhost:${port}${baseApi}`,
      SNYK_HOST: `http://localhost:${port}`,
      SNYK_TOKEN: '123456789',
      // code-client-go panics without an org UUID
      SNYK_CFG_ORG: '11111111-2222-3333-4444-555555555555',
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
    } as Record<string, string>;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => deepCodeServer.close(() => resolve()));
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // Called before every scan, not every test, so a test that scans twice sees only its
  // own requests.
  function configureServers() {
    server.restore();
    deepCodeServer.restore();
    server.setOrgSetting('sast', true);
    server.setLocalCodeEngineConfiguration({
      enabled: true,
      allowCloudUpload: true,
      url: `http://localhost:${deepCodeServer.getPort()}`,
    });
    deepCodeServer.setFiltersResponse({
      configFiles: [],
      extensions: ['.js'],
    });
    deepCodeServer.setSarifResponse({
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [],
    });
  }

  beforeEach(configureServers);

  async function buildFixture(testCase: FilterCase): Promise<string> {
    const root = fs.mkdtempSync(join(os.tmpdir(), 'snyk-gitignore-'));

    for (const [relPath, content] of Object.entries(testCase.files)) {
      const absPath = join(root, relPath);
      fs.mkdirSync(dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content);
    }

    if (!testCase.noGitRepo) {
      await runCommand('git', ['init'], { cwd: root });

      // Proves the built-in .git exclusion holds.
      fs.writeFileSync(join(root, '.git', 'planted.js'), 'const g = 9;\n');

      if (testCase.tracked?.length) {
        // -f: plain `git add` refuses gitignored paths.
        await runCommand('git', ['add', '-f', ...testCase.tracked], {
          cwd: root,
        });
      }
      if (testCase.untrack?.length) {
        await runCommand('git', ['rm', '--cached', '-q', ...testCase.untrack], {
          cwd: root,
        });
      }
    }

    for (const relPath of testCase.deleteFromWorktree ?? []) {
      fs.rmSync(join(root, relPath));
    }

    return testCase.scanSubdir ? join(root, testCase.scanSubdir) : root;
  }

  /** The files code-client-go uploaded, i.e. what survived the filter. */
  function uploadedFiles(): string[] {
    const bundleRequest = deepCodeServer
      .getRequests()
      .find(
        (r) => r.method === 'POST' && (r.url as string).includes('/bundle'),
      );

    if (!bundleRequest) return [];

    // Base64-encoded JSON map of { relativePath: fileHash }.
    const raw = Buffer.isBuffer(bundleRequest.body)
      ? Buffer.from(bundleRequest.body.toString('utf8'), 'base64').toString(
          'utf8',
        )
      : JSON.stringify(bundleRequest.body);

    return Object.keys(JSON.parse(raw)).sort();
  }

  async function scan(
    testCase: FilterCase,
    flagEnabled: boolean,
  ): Promise<{ files: string[]; code: number; stdout: string }> {
    configureServers();
    const scanPath = await buildFixture(testCase);
    const { code, stdout } = await runSnykCLI(`code test ${scanPath}`, {
      env: {
        ...baseEnv,
        [TRACKED_FILES_FLAG_ENV]: String(flagEnabled),
      },
    });
    return { files: uploadedFiles(), code, stdout };
  }

  describe.each([
    { label: 'flag off', flagEnabled: false },
    { label: 'flag on', flagEnabled: true },
  ])('$label', ({ flagEnabled }) => {
    it.each(cases)('$name', async (testCase) => {
      const expected = (
        flagEnabled ? testCase.expectedOn : testCase.expectedOff
      ).slice();

      const { files, code, stdout } = await scan(testCase, flagEnabled);

      // Catch a broken fixture masquerading as a filtering result.
      expect([EXIT_CODE_SUCCESS, EXIT_CODE_NO_SUPPORTED_FILES]).toContain(code);
      expect(stdout).not.toContain('SNYK-CODE-0006');

      expect(files).toEqual(expected.sort());
    });
  });

  // The feature is strictly additive: it may only ever un-ignore tracked files.
  describe('the flag is a no-op when nothing relevant is tracked', () => {
    const noOpCases = cases.filter(
      (c) => !c.tracked?.length || c.untrack?.length,
    );

    it.each(noOpCases)('$name', async (testCase) => {
      const off = await scan(testCase, false);
      const on = await scan(testCase, true);

      expect(on.files).toEqual(off.files);
    });
  });
});
