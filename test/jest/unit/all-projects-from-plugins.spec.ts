import { Options } from '../../../src/lib/types';
import { legacyPlugin as pluginApi } from '@snyk/cli-interface';
import { getExtraProjectCount } from '../../../src/lib/plugins/get-extra-project-count';

describe('Detect extra projects available that could be tested using --all-projects', () => {
  it('should return `undefined` when exists a single project', async () => {
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
    const expectedResult = undefined;
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

  it('should return `undefined` when `source` command for cpp is being used', async () => {
    const root = '';
    const inspectResult = {
      plugin: { meta: { allSubProjectNames: ['gradle-woof', 'npm-webapp'] } },
    } as pluginApi.InspectResult;

    const options = { source: true } as Options;
    const actualResult = await getExtraProjectCount(
      root,
      options,
      inspectResult,
    );
    const expectedResult = undefined;
    expect(actualResult).toBe(expectedResult);
  });

  it('should return `undefined` when `docker` command is being used', async () => {
    const root = '';
    const inspectResult = {
      plugin: {
        meta: {
          allSubProjectNames: ['gradle-goof', 'npm-node', ['yarn-yarn']],
        },
      },
    } as pluginApi.InspectResult;

    const options = { source: true } as Options;
    const actualResult = await getExtraProjectCount(
      root,
      options,
      inspectResult,
    );
    const expectedResult = undefined;
    expect(actualResult).toBe(expectedResult);
  });
});
