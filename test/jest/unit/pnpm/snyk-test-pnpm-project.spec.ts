import { NeedleResponse } from 'needle';
import test from '../../../../src/cli/commands/test';
import { CommandResult } from '../../../../src/cli/commands/types';
import { makeRequest } from '../../../../src/lib/request/request';
import * as featureFlagGateway from '../../../../src/lib/feature-flag-gateway';

import { getFixturePath } from '../../util/getFixturePath';
import { PNPM_FEATURE_FLAG } from '../../../../src/lib/package-managers';

jest.mock('../../../../src/lib/request/request');
jest.mock('../../../../src/lib/feature-flag-gateway');

const mockedMakeRequest = jest.mocked(makeRequest);
describe('snyk test for pnpm project', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (featureFlagGateway.getEnabledFeatureFlags as jest.Mock).mockResolvedValue(
      new Set(),
    );
  });

  beforeAll(() => {
    // this spy is for the `cliFailFast` feature flag
    jest
      .spyOn(featureFlagGateway, 'getEnabledFeatureFlags')
      .mockResolvedValue(new Set());
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('no local flag is used', () => {
    describe('project contains pnpm-lock.yaml file', () => {
      it('should scan pnpm vulnerabilities when enablePnpmCli feature flag is enabled', async () => {
        const fixturePath = getFixturePath('pnpm-app');

        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValue(new Set([PNPM_FEATURE_FLAG]));

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

        expect(featureFlagGateway.getEnabledFeatureFlags).toHaveBeenCalledWith(
          expect.any(Array),
          expect.any(String),
        );
        expect(mockedMakeRequest).toHaveBeenCalledTimes(1);
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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValueOnce(new Set([]));

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

        expect(mockedMakeRequest).toHaveBeenCalledTimes(1);

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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValue(new Set([PNPM_FEATURE_FLAG]));

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

        expect(mockedMakeRequest).toHaveBeenCalledTimes(10);

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
        (
          featureFlagGateway.getEnabledFeatureFlags as jest.Mock
        ).mockResolvedValueOnce(new Set());

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

        expect(mockedMakeRequest).toHaveBeenCalledTimes(6);

        const parsedResult = JSON.parse(result.getDisplayResults());
        const pnpmResult = parsedResult.filter(
          (result) => result.packageManager === 'pnpm',
        );
        expect(pnpmResult.length).toBe(0);
      });
    });
  });
});
