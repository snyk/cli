import * as fs from 'fs';
import * as os from 'os';
import * as pathLib from 'path';
import { Options } from '../../../src/lib/types';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { getExtraProjectCount } from '../../../src/lib/plugins/get-extra-project-count';

describe('Detect extra projects available that could be tested using --all-projects', () => {
  it('should return `1` when a single sub-projects is found', async () => {
    const root = '';
    const inspectResult = {
      plugin: { meta: { allSubProjectNames: ['gradle-woof'] } },
    } as pluginApi.InspectResult;

    const options = {} as Options;
    const actualResult = await getExtraProjectCount(
      root,
      options,
      inspectResult,
    );
    const expectedResult = 1;
    expect(actualResult).toBe(expectedResult);
  });

  it('should return `extra-project-count = 2` when exists more than a single project', async () => {
    const root = '';
    const inspectResult = {
      plugin: { meta: { allSubProjectNames: ['gradle-woof', 'npm-webapp'] } },
    } as pluginApi.InspectResult;

    const options = {} as Options;
    const actualResult = await getExtraProjectCount(
      root,
      options,
      inspectResult,
    );
    const expectedResult = 2;
    expect(actualResult).toBe(expectedResult);
  });

  it('should return `undefined` when `unmanaged` command for cpp is being used', async () => {
    const root = '';
    const inspectResult = {
      plugin: { meta: { allSubProjectNames: ['gradle-woof', 'npm-webapp'] } },
    } as pluginApi.InspectResult;

    const options = { unmanaged: true } as Options;
    const actualResult = await getExtraProjectCount(
      root,
      options,
      inspectResult,
    );
    const expectedResult = undefined;
    expect(actualResult).toBe(expectedResult);
  });

  describe('with symbolic links in the scanned directory', () => {
    let workspace: string;
    let root: string;
    const inspectResult = { plugin: {} } as pluginApi.InspectResult;

    beforeEach(() => {
      workspace = fs.realpathSync(
        fs.mkdtempSync(pathLib.join(os.tmpdir(), 'extra-project-count-')),
      );
      root = pathLib.join(workspace, 'root');
      fs.mkdirSync(root);
      fs.writeFileSync(pathLib.join(root, 'package.json'), '{}');
    });

    afterEach(() => {
      fs.rmSync(workspace, { recursive: true, force: true });
    });

    it('counts a real sibling project', async () => {
      fs.mkdirSync(pathLib.join(root, 'sibling'));
      fs.writeFileSync(pathLib.join(root, 'sibling', 'package.json'), '{}');

      expect(
        await getExtraProjectCount(root, {} as Options, inspectResult),
      ).toBe(1);
    });

    it('does not count a project reached through a symbolic link', async () => {
      const outside = pathLib.join(workspace, 'outside');
      fs.mkdirSync(outside);
      fs.writeFileSync(pathLib.join(outside, 'package.json'), '{}');
      try {
        fs.symlinkSync(outside, pathLib.join(root, 'linked'), 'junction');
      } catch {
        return;
      }

      expect(
        await getExtraProjectCount(root, {} as Options, inspectResult),
      ).toBeUndefined();
    });
  });
});
