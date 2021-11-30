import fse from 'fs-extra';
import os from 'os';
import path from 'path';
import { getFixturePath } from './getFixturePath';

type TestProject = {
  path: (filePath?: string) => string;
  read: (filePath: string) => Promise<string>;
  readJSON: (filePath: string) => Promise<any>;
  remove: () => Promise<void>;
};

/**
 * Copies a fixture to a temporary directory so that tests can be isolated
 * with minimal overlap and cleanup.
 */
const createProject = async (
  fixtureName: string,
  fixturePath: string,
): Promise<TestProject> => {
  const tempFolder = await fse.promises.realpath(
    await fse.promises.mkdtemp(
      path.resolve(
        os.tmpdir(),
        `snyk-test-${fixtureName.replace(/[/\\]/g, '-')}-`,
      ),
    ),
  );

  const projectPath = path.resolve(tempFolder, fixtureName);
  await fse.copy(fixturePath, projectPath);

  return {
    path: (filePath = '') => path.resolve(projectPath, filePath),
    read: (filePath: string) => {
      const fullFilePath = path.resolve(projectPath, filePath);
      return fse.readFile(fullFilePath, 'utf-8');
    },
    readJSON: async (filePath: string) => {
      const fullFilePath = path.resolve(projectPath, filePath);
      const strJson = await fse.readFile(fullFilePath, 'utf-8');
      return JSON.parse(strJson);
    },
    remove: () => {
      return fse.remove(tempFolder);
    },
  };
};

/**
 * Workaround until we move all fixtures to ./test/fixtures
 */
const createProjectFromWorkspace = async (
  fixtureName: string,
): Promise<TestProject> => {
  return createProject(
    fixtureName,
    path.join(__dirname, '../../acceptance/workspaces/' + fixtureName),
  );
};

/**
 * Once createProjectFromWorkspace is removed, this can be "createProject".
 */
const createProjectFromFixture = async (
  fixtureName: string,
): Promise<TestProject> => {
  return createProject(fixtureName, getFixturePath(fixtureName));
};

export {
  createProjectFromFixture as createProject,
  createProjectFromFixture,
  createProjectFromWorkspace,
};
