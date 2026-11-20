import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runSnykCLIWithArray } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

type Result = { code: number; stdout: string; stderr: string; file?: unknown };

type ParityCase = {
  name: string;
  args: string[];
  seed?: Record<string, string> | string;
  env?: Record<string, string>;
  xdg?: boolean;
  code?: number;
  stdout: string;
  file?: unknown;
  deviation?: Partial<Result>;
};

const usageError = (message: string) =>
  expect.stringMatching(
    new RegExp(
      `Incomplete command arguments \\(SNYK-CLI-0007\\)[\\s\\S]*${message}`,
    ),
  );

const invalidFlagOption = (message: string) =>
  expect.stringMatching(
    new RegExp(`Invalid flag option \\(SNYK-CLI-0004\\)[\\s\\S]*${message}`),
  );

// The detail wraps after "json-".
const jsonFileOutputNotSupported = invalidFlagOption(
  'not currently supported: config \\+ json-\\s*file-output',
);

// In sorted order, so the listing reads the same whether it follows the file or sorts the keys.
const seed = { a: '1', 'some-key': 'x y', z: 'v' };

const cases: ParityCase[] = [
  { name: 'lists nothing without a config file', args: [], stdout: '' },
  {
    name: 'lists the keys',
    args: [],
    seed,
    stdout: 'a: 1\nsome-key: x y\nz: v\n',
  },
  { name: 'get prints a set key', args: ['get', 'a'], seed, stdout: '1\n' },
  {
    name: 'get prints nothing for an unset key',
    args: ['get', 'nope'],
    seed,
    stdout: '',
  },
  {
    name: 'get prefers a non-empty SNYK_CFG_ variable over the file',
    args: ['get', 'some-key'],
    seed,
    env: { SNYK_CFG_SOME_KEY: 'from-env' },
    stdout: 'from-env\n',
  },
  {
    name: 'get reads a SNYK_CFG_ variable for a key missing from the file',
    args: ['get', 'new-key'],
    seed,
    env: { SNYK_CFG_NEW_KEY: 'from-env' },
    stdout: 'from-env\n',
  },
  {
    name: 'get ignores an empty SNYK_CFG_ variable',
    args: ['get', 'a'],
    seed,
    env: { SNYK_CFG_A: '' },
    stdout: '1\n',
  },
  {
    name: 'get ignores an unknown flag',
    args: ['get', 'a', '--unknown-flag'],
    seed,
    stdout: '1\n',
  },
  {
    name: 'set creates the file',
    args: ['set', 'a=1'],
    stdout: 'a updated\n\n',
    file: { a: '1' },
  },
  {
    name: 'set stores several keys',
    args: ['set', 'a=2', 'b=3'],
    seed,
    stdout: 'a updated\nb updated\n\n',
    file: { ...seed, a: '2', b: '3' },
  },
  {
    name: 'set splits on the first =',
    args: ['set', 'k=a=b'],
    seed,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'a=b' },
  },
  {
    name: 'set keeps a comma',
    args: ['set', 'k=a,b'],
    seed,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'a,b' },
  },
  {
    name: 'set keeps spaces',
    args: ['set', 'k=a b'],
    seed,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'a b' },
  },
  {
    name: 'set without arguments prints nothing',
    args: ['set'],
    seed,
    stdout: '',
  },
  {
    name: 'set writes the file under XDG_CONFIG_HOME',
    args: ['set', 'k=v'],
    seed,
    xdg: true,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'v' },
  },
  {
    name: 'unset deletes a key',
    args: ['unset', 'a'],
    seed,
    stdout: 'a deleted\n',
    file: { 'some-key': 'x y', z: 'v' },
  },
  {
    name: 'unset of a missing key changes nothing',
    args: ['unset', 'nope'],
    seed,
    stdout: 'nope deleted\n',
  },
  {
    name: 'clear empties the file',
    args: ['clear'],
    seed,
    stdout: 'config cleared\n',
    file: {},
  },
  {
    name: 'set drops the argument after an unknown flag',
    args: ['set', 'k=v', '--unknown-flag', 'x=y'],
    seed,
    stdout: 'k updated\nx updated\n\n',
    file: { ...seed, k: 'v', x: 'y' },
    deviation: { stdout: 'k updated\n\n', file: { ...seed, k: 'v' } },
  },
  {
    name: 'set without a value or a key is a usage error',
    args: ['set', 'a', '=x'],
    seed,
    stdout: 'a updated\n updated\n\n',
    file: { 'some-key': 'x y', z: 'v', '': 'x' },
    deviation: {
      code: 2,
      stdout: usageError('config:set requires arguments of the form KEY=VALUE'),
      file: seed,
    },
  },
  {
    name: 'set stores an empty value',
    args: ['set', 'k='],
    seed,
    stdout: 'k= updated\n\n',
    deviation: { stdout: 'k updated\n\n', file: { ...seed, k: '' } },
  },
  {
    name: 'set keeps a newline',
    args: ['set', 'k=a\nb'],
    seed,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'a' },
    deviation: { file: { ...seed, k: 'a\nb' } },
  },
  {
    name: 'set stores a dotted key flat',
    args: ['set', 'a.b=x'],
    stdout: 'a.b updated\n\n',
    file: { a: { b: 'x' } },
    deviation: { file: { 'a.b': 'x' } },
  },
  {
    name: 'set fails on invalid JSON and leaves the file',
    args: ['set', 'k=v'],
    seed: '{"a":',
    stdout: 'k updated\n\n',
    file: { k: 'v' },
    deviation: {
      code: 2,
      stdout: expect.stringMatching(
        /Unspecified Error \(SNYK-CLI-0000\)[\s\S]*unexpected EOF/,
      ),
      file: '{"a":',
    },
  },
  {
    name: 'get keeps number text as written',
    args: ['get', 'a'],
    seed: '{"a":1.50}',
    stdout: '1.5\n',
    file: { a: 1.5 },
    deviation: { stdout: '1.50\n' },
  },
  {
    name: 'get without a key is a usage error',
    args: ['get'],
    seed,
    code: 2,
    stdout: expect.stringMatching(
      /Unspecified Error \(SNYK-CLI-0000\)[\s\S]*config:get requires an argument/,
    ),
    deviation: { stdout: usageError('config:get requires an argument') },
  },
  {
    name: 'an unknown subcommand is a usage error',
    args: ['foo'],
    seed,
    code: 2,
    stdout: expect.stringMatching(
      /Unspecified Error \(SNYK-CLI-0000\)[\s\S]*Unknown config command "foo"/,
    ),
    deviation: { stdout: usageError('Unknown config command "foo"') },
  },
  {
    name: 'an output file flag without a value is a usage error',
    args: ['--json-file-output'],
    seed,
    code: 2,
    stdout: jsonFileOutputNotSupported,
    deviation: {
      stdout: invalidFlagOption('flag needs an argument: --json-file-output'),
    },
  },
  {
    name: 'an output file flag is not supported',
    args: [
      `--json-file-output=${path.join(os.tmpdir(), 'snyk-config-parity.json')}`,
    ],
    seed,
    code: 2,
    stdout: jsonFileOutputNotSupported,
    deviation: { stdout: jsonFileOutputNotSupported },
  },
  {
    name: 'lists the keys with --json',
    args: ['--json'],
    seed,
    stdout: 'a: 1\nsome-key: x y\nz: v\n',
  },
  {
    name: 'get prints a set key with --html',
    args: ['get', 'a', '--html'],
    seed,
    stdout: '1\n',
  },
  {
    name: 'set prints its result with --json',
    args: ['set', 'k=v', '--json'],
    seed,
    stdout: 'k updated\n\n',
    file: { ...seed, k: 'v' },
  },
  {
    name: 'lists INTERNAL_ values masked',
    args: [],
    seed: { INTERNAL_X: 's', api: 't' },
    stdout: 'INTERNAL_X: s\napi: t\n',
    deviation: { stdout: 'INTERNAL_X: ***\napi: t\n' },
  },
  {
    name: 'lists the keys sorted',
    args: [],
    seed: { z: '1', a: '2' },
    stdout: 'z: 1\na: 2\n',
    deviation: { stdout: 'a: 2\nz: 1\n' },
  },
];

// SNYK_*, INTERNAL_* and XDG_CONFIG_HOME from the shell would change the results.
const cleanEnvironment = (): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(snyk_|internal_|test_snyk|xdg_config_home$)/i.test(name),
    ),
  );

const readFile = (file: string): unknown => {
  if (!fs.existsSync(file)) return undefined;
  const text = fs.readFileSync(file, 'utf-8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const run = async (
  { args, seed, env, xdg }: ParityCase,
  legacy: boolean,
): Promise<Result> => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-config-parity-'));
  const configHome = path.join(home, xdg ? 'xdg' : '.config');
  const file = path.join(configHome, 'configstore', 'snyk.json');
  try {
    if (seed) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(
        file,
        typeof seed === 'string' ? seed : JSON.stringify(seed),
      );
    }
    const { code, stdout, stderr } = await runSnykCLIWithArray(
      ['config', ...args],
      {
        env: {
          ...cleanEnvironment(),
          HOME: home,
          USERPROFILE: home,
          SNYK_DISABLE_ANALYTICS: '1',
          ...(xdg && { XDG_CONFIG_HOME: configHome }),
          ...(legacy && { INTERNAL_SNYK_FF_CONFIG_LEGACY: 'true' }),
          ...env,
        },
      },
    );
    if (xdg) {
      expect(fs.existsSync(path.join(home, '.config'))).toBe(false);
    }
    return { code, stdout, stderr, file: readFile(file) };
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
};

describe('snyk config matches the legacy command', () => {
  it.each(cases)('$name', async (c) => {
    const legacy = await run(c, true);
    const native = await run(c, false);

    expect(legacy).toEqual({
      code: c.code ?? 0,
      stdout: c.stdout,
      stderr: '',
      file: c.file ?? c.seed,
    });
    expect(native).toEqual({ ...legacy, ...c.deviation });
  });
});
