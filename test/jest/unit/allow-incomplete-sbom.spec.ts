import * as path from 'path';
import {
  getDepsFromPlugin,
} from '../../../src/lib/plugins/get-deps-from-plugin';
import {
  getMultiPluginResult,
  MultiProjectResultCustom,
} from '../../../src/lib/plugins/get-multi-plugin-result';
import { Options, TestOptions } from '../../../src/lib/types';
import {
  createProject,
  createProjectFromWorkspace,
} from '../util/createProject';

jest.setTimeout(1000 * 60 * 5);

describe('allow-incomplete-sbom: error handling in plugin layer', () => {
  const baseOptions: Options & TestOptions = {
    path: '',
    showVulnPaths: 'some',
  };

  describe('getDepsFromPlugin — single project', () => {
    it('returns failedResults when plugin throws and flag is set', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-missing-lockfile',
      );

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        'print-output-jsonl-with-errors': true,
      };

      const result = (await getDepsFromPlugin(
        project.path(),
        options,
      )) as MultiProjectResultCustom;

      expect(result.scannedProjects).toHaveLength(0);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults).toHaveLength(1);
      expect(result.failedResults![0].targetFile).toBe('package.json');
      expect(result.failedResults![0].errMessage).toBeDefined();
      expect(result.failedResults![0].errMessage.length).toBeGreaterThan(0);
    });

    it('throws when plugin fails and flag is NOT set', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-missing-lockfile',
      );

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
      };

      await expect(
        getDepsFromPlugin(project.path(), options),
      ).rejects.toThrow();
    });

    it('succeeds for a valid project with the flag set', async () => {
      const project = await createProjectFromWorkspace('npm-package');

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        packageManager: 'npm',
        'print-output-jsonl-with-errors': true,
      };

      const result = (await getDepsFromPlugin(
        project.path(),
        options,
      )) as MultiProjectResultCustom;

      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.failedResults ?? []).toHaveLength(0);
    });
  });

  describe('getMultiPluginResult — multi project', () => {
    it('collects failedResults for broken projects alongside successful ones', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-partial-broken',
      );

      const targetFiles = [
        path.join(project.path(), 'valid-project', 'package.json'),
        path.join(project.path(), 'broken-project', 'package.json'),
      ];

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
        'print-output-jsonl-with-errors': true,
      };

      const result = await getMultiPluginResult(
        project.path(),
        options,
        targetFiles,
      );

      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults!.length).toBeGreaterThanOrEqual(1);

      const failed = result.failedResults![0];
      expect(failed.targetFile).toBeDefined();
      expect(failed.errMessage).toBeDefined();
      expect(failed.errMessage.length).toBeGreaterThan(0);
    });

    it('returns empty scannedProjects with failedResults when all projects fail and flag is set', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-all-broken',
      );

      const targetFiles = [
        path.join(project.path(), 'broken-project-a', 'package.json'),
        path.join(project.path(), 'broken-project-b', 'package.json'),
      ];

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
        'print-output-jsonl-with-errors': true,
      };

      const result = await getMultiPluginResult(
        project.path(),
        options,
        targetFiles,
      );

      expect(result.scannedProjects).toHaveLength(0);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults).toHaveLength(2);
      expect(result.failedResults![0].errMessage).toBeDefined();
      expect(result.failedResults![1].errMessage).toBeDefined();
    });

    it('throws when all projects fail and flag is NOT set', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-all-broken',
      );

      const targetFiles = [
        path.join(project.path(), 'broken-project-a', 'package.json'),
        path.join(project.path(), 'broken-project-b', 'package.json'),
      ];

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
      };

      await expect(
        getMultiPluginResult(project.path(), options, targetFiles),
      ).rejects.toThrow(/Failed to get dependencies/);
    });

    it('still returns failedResults for partial failure even without the flag', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-partial-broken',
      );

      const targetFiles = [
        path.join(project.path(), 'valid-project', 'package.json'),
        path.join(project.path(), 'broken-project', 'package.json'),
      ];

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
      };

      // With partial failure + some successes, getMultiPluginResult
      // always returns (doesn't throw). The flag only matters when ALL fail.
      const result = await getMultiPluginResult(
        project.path(),
        options,
        targetFiles,
      );

      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults!.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getDepsFromPlugin — allProjects integration', () => {
    it('collects both successes and failures with flag via allProjects', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-partial-broken',
      );

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
        'print-output-jsonl-with-errors': true,
      };

      const result = (await getDepsFromPlugin(
        project.path(),
        options,
      )) as MultiProjectResultCustom;

      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults!.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty results with errors when all projects fail with flag via allProjects', async () => {
      const project = await createProject(
        'sbom-allow-incomplete/npm-multi-all-broken',
      );

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
        'print-output-jsonl-with-errors': true,
      };

      const result = (await getDepsFromPlugin(
        project.path(),
        options,
      )) as MultiProjectResultCustom;

      expect(result.scannedProjects).toHaveLength(0);
      expect(result.failedResults).toBeDefined();
      expect(result.failedResults!.length).toBeGreaterThanOrEqual(1);
    });

    it('flag has no adverse effect when all projects succeed', async () => {
      const project = await createProjectFromWorkspace('npm-package');

      const options: Options & TestOptions = {
        ...baseOptions,
        path: project.path(),
        allProjects: true,
        'print-output-jsonl-with-errors': true,
      };

      const result = (await getDepsFromPlugin(
        project.path(),
        options,
      )) as MultiProjectResultCustom;

      expect(result.scannedProjects.length).toBeGreaterThanOrEqual(1);
      expect(result.failedResults ?? []).toHaveLength(0);
    });
  });
});
