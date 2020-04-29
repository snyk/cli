import { DepTree } from '../../types';
import { ContainerTarget } from '../types';

export async function getInfo(
  packageInfo: DepTree,
): Promise<ContainerTarget | null> {
  // safety check
  if (!packageInfo.docker) {
    return null;
  }

  return {
    image: (packageInfo as any).image || packageInfo.name,
  };
}
