import { DepTree } from '../../types';
import { ContainerTarget } from '../types';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';

export async function getInfo(
  scannedProject: ScannedProject,
  packageInfo: DepTree,
  isFromContainer: boolean,
): Promise<ContainerTarget | null> {
  // safety check
  if (!isFromContainer) {
    return null;
  }

  const imageNameOnProjectMeta =
    scannedProject.meta && scannedProject.meta.imageName;
  return {
    image:
      imageNameOnProjectMeta || (packageInfo as any).image || packageInfo.name,
  };
}
