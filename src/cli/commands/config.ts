import * as snyk from '../../lib';

const validMethods = ['set', 'get', 'unset', 'clear'];

export async function config(
  method?: 'set' | 'get' | 'unset' | 'clear',
  ...args: string[]
): Promise<string> {
  if (method && !validMethods.includes(method)) {
    throw new Error(`Unknown config command "${method}"`);
  }

  const key = args[0];

  if (method === 'set') {
    let res = '';

    args.forEach((item) => {
      const [key, val] = item.split('=');
      snyk.config.set(key, val);
      res += key + ' updated\n';

      // ensure we update the live library
      if (key === 'api') {
        (snyk as any).api = val;
      }
    });

    return res;
  }

  if (method === 'get') {
    if (!key) {
      throw new Error('config:get requires an argument');
    }

    return snyk.config.get(key) || '';
  }

  if (method === 'unset') {
    if (!key) {
      throw new Error('config:unset requires an argument');
    }
    snyk.config.delete(key);

    if (key === 'api') {
      // ensure we update the live library
      (snyk as any).api = null;
    }

    return `${key} deleted`;
  }

  if (method === 'clear') {
    snyk.config.clear();
    // ensure we update the live library
    (snyk as any).api = null;
    return 'config cleared';
  }

  return Object.keys(snyk.config.all)
    .sort((a, b) => Number(a.toLowerCase() < b.toLowerCase()))
    .map((configKey) => `${configKey}: ${snyk.config.all[configKey]}`)
    .join('\n')
    .trim();
}
