import * as cppPlugin from 'snyk-cpp-plugin';
import { Options } from './types';
import { TestCommandResult } from '../cli/commands/types';

interface Artifact {
  type: string;
  data: any;
  meta?: { [key: string]: any };
}

interface ScanResult {
  artifacts: Artifact[];
}

export interface EcosystemPlugin {
  scan: (options: Options) => Promise<ScanResult[]>;
  display: (scanResults: ScanResult[]) => Promise<string>;
}

export type Ecosystem = 'cpp';

const EcosystemPlugins: {
  readonly [ecosystem in Ecosystem]: EcosystemPlugin;
} = {
  cpp: cppPlugin,
};

export function getPlugin(ecosystem: Ecosystem): EcosystemPlugin {
  return EcosystemPlugins[ecosystem];
}

export function getEcosystem(options: Options): Ecosystem | null {
  if (options.source) {
    return 'cpp';
  }
  return null;
}

export async function testEcosystem(
  ecosystem: Ecosystem,
  paths: string[],
  options: Options,
): Promise<TestCommandResult> {
  const plugin = getPlugin(ecosystem);
  let allScanResults: ScanResult[] = [];
  for (const path of paths) {
    options.path = path;
    const scanResults = await plugin.scan(options);
    allScanResults = allScanResults.concat(scanResults);
  }

  const stringifiedData = JSON.stringify(allScanResults, null, 2);
  if (options.json) {
    return TestCommandResult.createJsonTestCommandResult(stringifiedData);
  }

  const readableResult = await plugin.display(allScanResults);
  return TestCommandResult.createHumanReadableTestCommandResult(
    readableResult,
    stringifiedData,
  );
}
