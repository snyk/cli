import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runSnykCLIWithArray } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

type ParityCase = {
  name: string;
  args: string[];
  seed?: Record<string, string>;
  env?: Record<string, string>;
  xdg?: boolean;
  stdout: string;
  file?: Record<string, string>;
};

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
];

// SNYK_*, INTERNAL_* and XDG_CONFIG_HOME from the shell would change the results.
const cleanEnvironment = (): Record<string, string | undefined> =>
  Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) => !/^(snyk_|internal_|test_snyk|xdg_config_home$)/i.test(name),
    ),
  );

const readFile = (file: string): unknown =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : undefined;

const run = async ({ args, seed, env, xdg }: ParityCase, legacy: boolean) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-config-parity-'));
  const configHome = path.join(home, xdg ? 'xdg' : '.config');
  const file = path.join(configHome, 'configstore', 'snyk.json');
  try {
    if (seed) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(seed));
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
      code: 0,
      stdout: c.stdout,
      stderr: '',
      file: c.file ?? c.seed,
    });
    expect(native).toEqual(legacy);
  });
});
