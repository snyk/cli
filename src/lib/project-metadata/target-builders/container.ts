import { DepTree } from '../../types';
import { ContainerTarget } from '../types';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';

export async function getInfo({
  isFromContainer,
  scannedProject,
  packageInfo,
}: {
  isFromContainer: boolean;
  scannedProject: ScannedProject;
  packageInfo?: DepTree;
}): Promise<ContainerTarget | null> {
  // safety check
  if (!isFromContainer) {
    return null;
  }

  const imageNameOnProjectMeta =
    scannedProject.meta && scannedProject.meta.imageName;
  return {
    image:
      imageNameOnProjectMeta ||
      (packageInfo as any)?.image ||
      packageInfo?.name,
  };
}
