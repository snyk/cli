import * as common from '../../src/common';
import * as fs from 'fs';
import * as child_process from 'child_process';
import * as path from 'path';

interface TestEnvironmentInfo {
  inputfolder: string;
  outputfolder: string;
}

export async function prepareEnvironment(
  version: string,
): Promise<TestEnvironmentInfo> {
  const inputfolder = path.join(__dirname, '..', '..', 'src');
  const outputfolder = path.join(__dirname, 'something');
  const versionFile = common.versionFile.replace(inputfolder, outputfolder);
  const shasumFile = common.shasumFile.replace(inputfolder, outputfolder);

  if (fs.existsSync(outputfolder)) {
    fs.rmSync(outputfolder, { recursive: true });
  }

  fs.mkdirSync(path.join(outputfolder, 'generated'), { recursive: true });

  const tsc = child_process.spawnSync(
    'npx tsc  --outDir ' +
      outputfolder +
      ' --tsBuildInfoFile ' +
      path.join(outputfolder, 'tsconfig.tsbuildinfo'),
    { cwd: inputfolder, shell: true },
  );

  if (tsc.status) {
    console.debug(tsc);
    console.debug(tsc.stdout.toString());
    console.debug(tsc.stderr.toString());
  }

  fs.writeFileSync(versionFile, version);

  await common.downloadExecutable(
    'https://static.snyk.io/cli/v' + version + '/sha256sums.txt.asc',
    shasumFile,
    '',
  );

  return { inputfolder, outputfolder };
}

if (process.argv.includes('exec')) {
  (async function() {
    await prepareEnvironment('1.1080.0');
  });
}
