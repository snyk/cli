import * as fse from 'fs-extra';
import * as path from 'path';
import { runCommand } from './runCommand';
import { debuglog } from 'util';

type PackageJSON = {
  dependencies?: Record<string, string>;
};

const debug = debuglog('@snyk' + __filename);

const useLocalPackage = async (projectPath: string) => {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const { stdout: tarballName } = await runCommand('npm', ['pack'], {
    cwd: workspaceRoot,
  });

  const packageJsonPath = path.resolve(projectPath, 'package.json');
  const currentPackageJson = await fse.readFile(packageJsonPath, 'utf-8');
  const packageJson: PackageJSON = JSON.parse(currentPackageJson);

  if (packageJson.dependencies) {
    packageJson.dependencies['@snyk/protect'] = path.resolve(
      workspaceRoot,
      tarballName,
    );
  }

  const nextPackageJson = JSON.stringify(packageJson, null, 2) + '\n';
  if (currentPackageJson !== nextPackageJson) {
    debug('useLocalPackage: %s', packageJsonPath);
    await fse.writeFile(packageJsonPath, nextPackageJson);
  }
};

export { useLocalPackage };
