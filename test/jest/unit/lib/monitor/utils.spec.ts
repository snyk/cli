import { getProjectName } from '../../../../../src/lib/monitor/utils';
import { MonitorMeta } from '../../../../../src/lib/types';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';

describe('utils', () => {
  describe('getProjectName', () => {
    it('if project name flag provided and scannedProject.meta.projectName exists, use the scannedProject value', () => {
      const mockScannedProject = {
        meta: { projectName: 'newPackageName' },
      } as ScannedProject;

      const mockMeta = { 'project-name': 'newPackageName' } as MonitorMeta;

      expect(getProjectName(mockScannedProject, mockMeta)).toBe(
        'newPackageName',
      );
    });

    it('if project name flag not provided at all, should return undefined', () => {
      const mockScannedProjectNoHex = {
        meta: { projectName: 'newPackageName' },
      } as ScannedProject;

      const mockMeta = {} as MonitorMeta;

      expect(getProjectName(mockScannedProjectNoHex, mockMeta)).toBeUndefined();
    });
  });
});
