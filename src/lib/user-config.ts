import * as path from 'path';
const Configstore = require('configstore');

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

function configFileOptions(): { configPath?: string } {
  const configPath = process.env.SNYK_INTERNAL_CONFIG_FILE;
  if (configPath === undefined) {
    return {};
  }
  if (!path.isAbsolute(configPath)) {
    throw new Error(
      `SNYK_INTERNAL_CONFIG_FILE must be an absolute path: ${configPath}`,
    );
  }
  return { configPath };
}

export const config = new ConfigStoreWithEnvironmentVariables(
  'snyk',
  undefined,
  configFileOptions(),
);
