import * as fse from 'fs-extra';
import * as path from 'path';
import { runCommand } from './runCommand';

type PackageJSON = {
  scripts?: Record<string, string>;
};

const useLocalPackage = async (projectPath: string) => {
  const workspaceRoot = path.resolve(__dirname, '../..');
  const { stdout: tarballName } = await runCommand('npm', ['pack'], {
    cwd: workspaceRoot,
  });

  const currentPackageJson = await fse.readFile(
    path.resolve(projectPath, 'package.json'),
    'utf-8',
  );
  const packageJson: PackageJSON = JSON.parse(currentPackageJson);

  if (packageJson.scripts?.prepublish) {
    packageJson.scripts.prepublish = packageJson.scripts.prepublish.replace(
      '@snyk/protect',
      path.resolve(workspaceRoot, tarballName),
    );
  }

  const nextPackageJson = JSON.stringify(packageJson, null, 2) + '\n';
  if (currentPackageJson !== nextPackageJson) {
    await fse.writeFile(
      path.resolve(projectPath, 'package.json'),
      nextPackageJson,
    );
  }
};

export { useLocalPackage };
