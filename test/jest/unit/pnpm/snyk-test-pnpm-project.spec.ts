import { NeedleResponse } from 'needle';
import test from '../../../../src/cli/commands/test';
import { CommandResult } from '../../../../src/cli/commands/types';
import { makeRequest } from '../../../../src/lib/request/request';
import * as featureFlagsModule from '../../../../src/lib/feature-flags';
import { getFixturePath } from '../../util/getFixturePath';

jest.mock('../../../../src/lib/request/request');

const mockedMakeRequest = jest.mocked(makeRequest);
describe('snyk test for pnpm project', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  beforeAll(() => {
    // this spy is for the `cliFailFast` feature flag
    jest
      .spyOn(featureFlagsModule, 'isFeatureFlagSupportedForOrg')
      .mockResolvedValue({
        ok: true,
      });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('no local flag is used', () => {
    describe('project contains pnpm-lock.yaml file', () => {
      it('should scan pnpm vulnerabilities when enablePnpmCli feature flag is enabled', async () => {
        const fixturePath = getFixturePath('pnpm-app');

        // this is for 'enablePnpmCli' feature flag
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: true,
            },
          });
        });

        // this is for 'show-maven-build-scope' and 'show-npm-scope' feature flags
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: true,
            },
          });
        });
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: true,
            },
          });
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
        });

        expect(mockedMakeRequest).toHaveBeenCalledTimes(4);
        expect(mockedMakeRequest).toHaveBeenCalledWith(
          expect.objectContaining({
            body: expect.objectContaining({
              displayTargetFile: 'pnpm-lock.yaml',
            }),
          }),
        );

        const expectedResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 4,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'pnpm',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          projectName: 'one-dep',
          foundProjectCount: undefined,
          displayTargetFile: 'pnpm-lock.yaml',
          platform: undefined,
          hasUnknownVersions: false,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(expectedResultObject, null, 2),
        });
      });

      it('should scan pnpm vulnerabilities as npm project when enablePnpmCli feature flag is not enabled', async () => {
        const fixturePath = getFixturePath('pnpm-app');

        // this is for 'enablePnpmCli' feature flag
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: false,
            },
          });
        });

        // this is for 'show-maven-build-scope' and 'show-npm-scope' feature flags
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: false,
            },
          });
        });
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: false,
            },
          });
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
        });

        expect(mockedMakeRequest).toHaveBeenCalledTimes(4);

        const expectedResultObject = {
          vulnerabilities: [],
          ok: true,
          dependencyCount: 2,
          org: 'test-org',
          policy: undefined,
          isPrivate: true,
          licensesPolicy: null,
          packageManager: 'npm',
          projectId: undefined,
          ignoreSettings: null,
          docker: undefined,
          summary: 'No known vulnerabilities',
          severityThreshold: undefined,
          remediation: undefined,
          filesystemPolicy: false,
          uniqueCount: 0,
          projectName: 'one-dep',
          foundProjectCount: undefined,
          displayTargetFile: 'package.json',
          platform: undefined,
          hasUnknownVersions: false,
          path: fixturePath,
        };
        expect(result).toMatchObject({
          result: JSON.stringify(expectedResultObject, null, 2),
        });
      });
    });
  });

  describe('--all-projects flag is used to scan the project', () => {
    describe('when enablePnpmCli feature flag is present', () => {
      it('should scan pnpm workspace vulnerabilities', async () => {
        const fixturePath = getFixturePath('workspace-multi-type');

        // this is for 'enablePnpmCli' feature flag
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: true,
            },
          });
        });

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
        });

        expect(mockedMakeRequest).toHaveBeenCalledTimes(13);

        const parsedResult = JSON.parse(result.getDisplayResults());
        const pnpmResult = parsedResult.filter(
          (result) => result.packageManager === 'pnpm',
        );
        expect(pnpmResult.length).toBe(6);
      });
    });

    describe('when enablePnpmCli feature flag is not present', () => {
      it('should not scan pnpm workspace vulnerabilities, only npm and yarn', async () => {
        const fixturePath = getFixturePath('workspace-multi-type');

        // this is for 'enablePnpmCli' feature flag
        mockedMakeRequest.mockImplementationOnce(() => {
          return Promise.resolve({
            res: { statusCode: 200 } as NeedleResponse,
            body: {
              code: 200,
              ok: false,
            },
          });
        });

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
        });

        expect(mockedMakeRequest).toHaveBeenCalledTimes(9);

        const parsedResult = JSON.parse(result.getDisplayResults());
        const pnpmResult = parsedResult.filter(
          (result) => result.packageManager === 'pnpm',
        );
        expect(pnpmResult.length).toBe(0);
      });
    });
  });
});
