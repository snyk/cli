import { runSnykCLI } from '../jest/util/runSnykCLI';

export async function getCliConfig(): Promise<Record<string, string>> {
  let initialConfig: Record<string, string> = {};
  const { stdout } = await runSnykCLI('config');
  if (stdout) {
    initialConfig = stdout
      .trim()
      .split('\n')
      .reduce((acc, line) => {
        const [key, value] = line.split(': ');
        return {
          ...acc,
          [key]: value,
        };
      }, {});
  }
  return initialConfig;
}

export async function restoreCliConfig(config: Record<string, string>) {
  await runSnykCLI('config clear');
  if (Object.keys(config).length > 0) {
    for (const key in config) {
      await runSnykCLI(`config set ${key}=${config[key]}`);
    }
  }
}
