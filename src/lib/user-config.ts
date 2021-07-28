const Configstore = require('configstore');
const pkg = require(__dirname + '/../../package.json');

// eslint-disable-next-line import/no-unused-modules
export class ConfigStoreWithEnvironmentVariables extends Configstore {
  constructor(id, defaults = undefined, options = {}) {
    super(id, defaults, options);
  }

  public get(key: string): string | undefined {
    const envKey = `SNYK_CFG_${key.replace(/-/g, '_').toUpperCase()}`;
    const envValue = process.env[envKey];
    return super.has(key) && !envValue ? String(super.get(key)) : envValue;
  }
}

export const config = new ConfigStoreWithEnvironmentVariables(pkg.name);
