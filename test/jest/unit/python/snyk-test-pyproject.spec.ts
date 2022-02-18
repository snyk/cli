import { mocked } from 'ts-jest/utils';
import { NeedleResponse } from 'needle';
import test from '../../../../src/cli/commands/test';
import { loadPlugin } from '../../../../src/lib/plugins/index';
import { CommandResult } from '../../../../src/cli/commands/types';
import { makeRequest } from '../../../../src/lib/request/request';
import * as featureFlagsModule from '../../../../src/lib/feature-flags';
import { getWorkspacePath } from '../../util/getWorkspacePath';
import { getFixturePath } from '../../util/getFixturePath';

jest.mock('../../../../src/lib/plugins/index');
jest.mock('../../../../src/lib/request/request');

const mockedLoadPlugin = mocked(loadPlugin, true);
const mockedMakeRequest = mocked(makeRequest);

describe('snyk test for python project', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // this spy is for the `cliFailFast` feature flag
    jest
      .spyOn(featureFlagsModule, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({
        ok: false,
      });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('no flag is used', () => {
    describe('project contains pyproject.toml file', () => {
      it('should scan poetry vulnerabilities', async () => {
        const fixturePath = getWorkspacePath('poetry-app');

        const plugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'pyproject.toml',
                name: 'snyk-python-plugin',
                runtime: 'Python',
              },
              package: {},
            };
          },
        };
        mockedLoadPlugin.mockImplementationOnce(() => {
          return plugin;
        });
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              result: { issuesData: {}, affectedPkgs: {} },
              meta: { org: 'test-org', isPublic: false },
              filesystemPolicy: false,
            },
          });
        });

        const result: CommandResult = await test(fixturePath, {
          json: true,
          _: [],
          _doubleDashArgs: [],
          rawArgv: [],
        });

        expect(mockedLoadPlugin).toHaveBeenCalledTimes(1);
        expect(mockedLoadPlugin).toHaveBeenCalledWith('poetry');

        expect(mockedMakeRequest).toHaveBeenCalledTimes(1);
        expect(mockedMakeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              displayTargetFile: 'pyproject.toml',
            }),
          }),
        );

        const expectedResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 0,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'poetry',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          targetFile: 'pyproject.toml',
          projectName: undefined,
          foundProjectCount: undefined,
          displayTargetFile: 'pyproject.toml',
          platform: undefined,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(expectedResultObject, null, 2),
        });
      });
    });
  });

  describe('--all-projects flag is used to scan the project', () => {
    describe('project does not contain poetry.lock file', () => {
      it('should not attempt to scan poetry vulnerabilities', async () => {
        const fixturePath = getFixturePath('pyproject-without-poetry');
        const plugin = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Pipfile',
                name: 'snyk-python-plugin',
                runtime: 'Python',
              },
              package: {},
            };
          },
        };
        mockedLoadPlugin.mockImplementationOnce(() => {
          return plugin;
        });
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              result: { issuesData: {}, affectedPkgs: {} },
              meta: { org: 'test-org', isPublic: false },
              filesystemPolicy: false,
            },
          });
        });

        const result: CommandResult = await test(fixturePath, {
          allProjects: true,
          json: true,
          _: [],
          _doubleDashArgs: [],
          rawArgv: [],
        });

        expect(mockedLoadPlugin).toHaveBeenCalledTimes(1);
        expect(mockedLoadPlugin).toHaveBeenCalledWith('pip');

        expect(mockedMakeRequest).toHaveBeenCalledTimes(1);
        expect(mockedMakeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              displayTargetFile: 'Pipfile',
            }),
          }),
        );

        const expectedResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 0,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'pip',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          targetFile: 'Pipfile',
          projectName: undefined,
          foundProjectCount: undefined,
          displayTargetFile: 'Pipfile',
          platform: undefined,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(expectedResultObject, null, 2),
        });
      });
    });

    describe('project does contain poetry.lock file', () => {
      it('should scan poetry vulnerabilities', async () => {
        const fixturePath = getFixturePath('pyproject-with-poetry');
        const pipfilePythonPluginResponse = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'Pipfile',
                name: 'snyk-python-plugin',
                runtime: 'Python',
              },
              package: {},
            };
          },
        };
        const pyprojectPythonPluginResponse = {
          async inspect() {
            return {
              plugin: {
                targetFile: 'pyproject.toml',
                name: 'snyk-python-plugin',
                runtime: 'Python',
              },
              package: {},
            };
          },
        };
        mockedLoadPlugin
          .mockImplementationOnce(() => pipfilePythonPluginResponse)
          .mockImplementationOnce(() => pyprojectPythonPluginResponse);
        mockedMakeRequest.mockImplementation(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              result: { issuesData: {}, affectedPkgs: {} },
              meta: { org: 'test-org', isPublic: false },
              filesystemPolicy: false,
            },
          });
        });

        const result: CommandResult = await test(fixturePath, {
          allProjects: true,
          json: true,
          _: [],
          _doubleDashArgs: [],
          rawArgv: [],
        });

        expect(mockedLoadPlugin).toHaveBeenCalledTimes(2);
        expect(mockedLoadPlugin).toHaveBeenCalledWith('pip');
        expect(mockedLoadPlugin).toHaveBeenCalledWith('poetry');

        expect(mockedMakeRequest).toHaveBeenCalledTimes(2);
        expect(mockedMakeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              displayTargetFile: 'Pipfile',
              foundProjectCount: 1,
            }),
          }),
        );
        expect(mockedMakeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              displayTargetFile: 'pyproject.toml',
              foundProjectCount: 1,
            }),
          }),
        );

        const expectedPipfileResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 0,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'pip',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          targetFile: 'Pipfile',
          foundProjectCount: 1,
          projectName: undefined,
          displayTargetFile: 'Pipfile',
          platform: undefined,
          path: fixturePath,
        };
        const expectedPyprojectResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 0,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'poetry',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          targetFile: 'pyproject.toml',
          foundProjectCount: 1,
          projectName: undefined,
          displayTargetFile: 'pyproject.toml',
          platform: undefined,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(
            [expectedPipfileResultObject, expectedPyprojectResultObject],
            null,
            2,
          ),
        });
      });
    });
  });
});
