import * as fse from 'fs-extra';
import * as path from 'path';
import * as uuid from 'uuid';
import protect from '../../src/lib';

type TestProject = {
  path: string;
  file: (filePath: string) => Promise<string>;
};

describe('@snyk/protect', () => {
  let tempFolder: string;

  const createProject = async (fixture: string): Promise<TestProject> => {
    const fixturePath = path.join(__dirname, '../fixtures', fixture);
    const projectPath = path.join(tempFolder, fixture);
    await fse.copy(fixturePath, projectPath);
    return {
      path: projectPath,
      file: (filePath: string) => {
        const fullFilePath = path.join(projectPath, filePath);
        return fse.readFile(fullFilePath, 'utf-8');
      },
    };
  };

  beforeAll(async () => {
    tempFolder = path.join(__dirname, '__output__', uuid.v4());
    await fse.ensureDir(tempFolder);
  });

  afterAll(async () => {
    await fse.remove(tempFolder);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('applies patch(es)', () => {
    it('works for project with a single patchable module', async () => {
      const project = await createProject('single-patchable-module');

      await protect(project.path);

      expect(
        project.file('node_modules/nyc/node_modules/lodash/lodash.js'),
      ).resolves.toMatchSnapshot();
    });

    it('works for project with multiple patchable modules', async () => {
      const project = await createProject('multiple-matching-paths');

      await protect(project.path);

      expect(
        project.file('node_modules/nyc/node_modules/lodash/lodash.js'),
      ).resolves.toMatchSnapshot();
      expect(
        project.file('node_modules/lodash/lodash.js'),
      ).resolves.toMatchSnapshot();
    });
  });

  describe('does not apply any patches and does not fail', () => {
    // in this scenario .snyk file has a vulnId which corresponds to the `lodash` package, but there are not instances of lodash in the node_modules
    it('for project with no modules with the target package name', async () => {
      const project = await createProject('no-matching-paths');
      const log = jest.spyOn(global.console, 'log');

      await protect(project.path);

      expect(log).toHaveBeenCalledWith('Nothing to patch, done');
    });

    // skipped because we need to check the versions of the found modules before we attempt to patch them which we don't currently do
    // and in order to do that, we need to first switch over to the new endpoint
    // it('for a project that has an instance of the target module but we have no patches for its version', async () => {
    //   const project = await createProject('target-module-exists-but-no-patches-for-version');
    //   const log = jest.spyOn(global.console, 'log');
    //   await protect(project.path);
    //   expect(log).toHaveBeenCalledWith('Nothing to patch, done');
    // });

    // fixture has a lodash@4.14.1 which we don't have patches for
    it('for project with no .snyk file', async () => {
      const project = await createProject('no-snyk-file');
      const log = jest.spyOn(global.console, 'log');

      await protect(project.path);

      expect(log).toHaveBeenCalledWith('No .snyk file found');
    });
  });
});
