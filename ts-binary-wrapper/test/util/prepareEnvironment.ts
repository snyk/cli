import * as common from '../../src/common';
import * as child_process from 'child_process';
import * as path from 'path';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'fs';

export class TestEnvironmentSetup {
  constructor(
    readonly root = path.join(__dirname, '..', '..', '..'),
    readonly inputfolder = path.join(__dirname, '..', '..', 'src'),
    readonly outputfolder = path.join(__dirname, 'something'),
  ) {
    this.root = root;
    this.inputfolder = inputfolder;
    this.outputfolder = outputfolder;
  }

  async prepareEnvironment(version: string) {
    const versionFile = common.versionFile.replace(
      this.inputfolder,
      this.outputfolder,
    );
    const shasumFile = common.shasumFile.replace(
      this.inputfolder,
      this.outputfolder,
    );

    try {
      this.prepareDirectories();
      this.compileTSCode();
      writeFileSync(versionFile, version);
      await this.downloadShaSum(version, shasumFile);
    } catch (error) {
      console.error('Error while preparing environment');
      console.error(error);
      throw error;
    }
  }

  cleanupDirectories() {
    rmdirSync(this.outputfolder, { recursive: true }); // remove output folder
  }

  prepareDirectories() {
    mkdirSync(path.join(this.outputfolder, 'generated'), {
      recursive: true,
    });

    copyFileSync(
      path.join(this.root, 'binary-deployments.json'),
      path.join(this.outputfolder, 'generated', 'binary-deployments.json'),
    );
  }

  private compileTSCode() {
    const tsc = child_process.spawnSync(
      'npx tsc  --outDir ' +
        this.outputfolder +
        ' --tsBuildInfoFile ' +
        path.join(this.outputfolder, 'tsconfig.tsbuildinfo'),
      { cwd: this.inputfolder, shell: true },
    );

    if (tsc.status) {
      console.debug(tsc);
      console.debug(tsc.stdout.toString());
      console.debug(tsc.stderr.toString());
    }
  }

  private async downloadShaSum(version: string, shasumFile: string) {
    await common.downloadExecutable(
      'https://downloads.snyk.io/cli/v' + version + '/sha256sums.txt.asc',
      shasumFile,
      [],
    );

    const experimentalShasumFile = shasumFile + '.experimental';
    await common.downloadExecutable(
      'https://downloads.snyk.io/experimental/cli/v' +
        version +
        '/sha256sums.txt.asc',
      experimentalShasumFile,
      [],
    );

    const experimentalLines = readFileSync(experimentalShasumFile, 'utf8')
      .split('\n')
      .filter((line: string) => /^[a-zA-Z0-9]/.test(line))
      .map((line: string) => line.replace(/(\s+\*?)(\S+)$/, '$1experimental/$2'))
      .join('\n');
    appendFileSync(shasumFile, '\n' + experimentalLines);
    unlinkSync(experimentalShasumFile);
  }
}

if (process.argv.includes('exec')) {
  (async function () {
    const env = new TestEnvironmentSetup();
    await env.prepareEnvironment('1.1292.1');
  })();
}
