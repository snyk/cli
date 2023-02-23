import * as common from '../../src/common';
import * as child_process from 'child_process';
import * as path from 'path';
import { copyFile, mkdir, rm, stat, writeFile } from 'fs/promises';

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
      await this.prepareDirectories();
      this.spawnProcess();
      await writeFile(versionFile, version);
      await this.downloadExecutable(version, shasumFile);
    } catch (error) {
      console.error('Error while preparing environment');
      throw error;
    }
  }

  async cleanupEnvironment() {
    await rm(this.outputfolder, { recursive: true }); // remove output folder
    await rm(path.join(this.inputfolder, 'generated'), { recursive: true }); // remove generated folder
  }

  private async prepareDirectories() {
    await mkdir(path.join(this.outputfolder, 'generated'), {
      recursive: true,
    });

    // check and copy binary-deployments.json
    const binaryDeploymentsExists = await stat(
      path.join(this.root, 'binary-deployments.json'),
    );
    if (binaryDeploymentsExists) {
      await mkdir(path.join(this.inputfolder, 'generated'), {
        recursive: true,
      });

      await copyFile(
        path.join(this.root, 'binary-deployments.json'),
        path.join(this.inputfolder, 'generated', 'binary-deployments.json'),
      );
      
      await copyFile(
        path.join(this.root, 'binary-deployments.json'),
        path.join(this.outputfolder, 'generated', 'binary-deployments.json'),
      );
    }
  }

  private spawnProcess() {
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

  private async downloadExecutable(version: string, shasumFile: string) {
    await common.downloadExecutable(
      'https://static.snyk.io/cli/v' + version + '/sha256sums.txt.asc',
      shasumFile,
      '',
    );
  }
}


if (process.argv.includes('exec')) {
  (async function() {
    const env = new TestEnvironmentSetup();
    await env.prepareEnvironment('1.1080.0');
  });
}
