import * as fse from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { useLocalPackage } from './useLocalPackage';
import { debuglog } from 'util';

type TestProject = {
  path: (filePath?: string) => string;
  read: (filePath: string) => Promise<string>;
  remove: () => Promise<void>;
};

const debug = debuglog('@snyk' + __filename);

const createProject = async (fixtureName: string): Promise<TestProject> => {
  const tempFolder = await fse.promises.mkdtemp(
    path.resolve(os.tmpdir(), `snyk-test-${fixtureName}-`),
  );

  const fixturePath = path.resolve(__dirname, '../fixtures', fixtureName);
  const projectPath = path.resolve(tempFolder, fixtureName);
  await fse.copy(fixturePath, projectPath);

  if (process.env.PRODUCTION_TEST !== '1') {
    await useLocalPackage(projectPath);
  }

  debug('createProject: %s', projectPath);

  return {
    path: (filePath = '') => path.resolve(projectPath, filePath),
    read: (filePath: string) => {
      const fullFilePath = path.resolve(projectPath, filePath);
      return fse.readFile(fullFilePath, 'utf-8');
    },
    remove: () => {
      return fse.remove(tempFolder);
    },
  };
};

export { createProject };
