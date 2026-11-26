import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('user config', () => {
  const originalConfigFile = process.env.SNYK_INTERNAL_CONFIG_FILE;
  let dir: string;

  const loadConfig = () => {
    let config;
    jest.isolateModules(() => {
      config = require('../../../../src/lib/user-config').config;
    });
    return config;
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-user-config-'));
  });

  afterEach(() => {
    if (originalConfigFile === undefined) {
      delete process.env.SNYK_INTERNAL_CONFIG_FILE;
    } else {
      process.env.SNYK_INTERNAL_CONFIG_FILE = originalConfigFile;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads and writes the file named by SNYK_INTERNAL_CONFIG_FILE', () => {
    const file = path.join(dir, 'work.json');
    fs.writeFileSync(file, JSON.stringify({ endpoint: 'https://work' }));
    process.env.SNYK_INTERNAL_CONFIG_FILE = file;

    const config = loadConfig();
    config.set('api', 'work-token');

    expect(config.path).toEqual(file);
    expect(config.get('endpoint')).toEqual('https://work');
    expect(JSON.parse(fs.readFileSync(file, 'utf8'))).toEqual({
      endpoint: 'https://work',
      api: 'work-token',
    });
  });

  it('refuses a relative SNYK_INTERNAL_CONFIG_FILE', () => {
    process.env.SNYK_INTERNAL_CONFIG_FILE = 'work.json';

    expect(loadConfig).toThrow(
      'SNYK_INTERNAL_CONFIG_FILE must be an absolute path: work.json',
    );
  });

  it('uses the default file without SNYK_INTERNAL_CONFIG_FILE', () => {
    delete process.env.SNYK_INTERNAL_CONFIG_FILE;

    expect(
      loadConfig().path.endsWith(path.join('configstore', 'snyk.json')),
    ).toBe(true);
  });
});
