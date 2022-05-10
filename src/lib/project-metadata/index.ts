import * as gitTargetBuilder from './target-builders/git';
import * as containerTargetBuilder from './target-builders/container';
import { GitTarget, ContainerTarget } from './types';
import { DepTree } from '../types';
import { InvalidRemoteUrlError } from '../errors/invalid-remote-url-error';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';

const TARGET_BUILDERS = [containerTargetBuilder, gitTargetBuilder];
interface Options {
  'remote-repo-url'?: string;
  docker?: boolean; // docker is coming from Options/TestOptions
  isDocker?: boolean; // isDocker coming from MonitorMeta
}
export async function getInfo(
  scannedProject: ScannedProject,
  options: Options,
  packageInfo?: DepTree,
): Promise<GitTarget | ContainerTarget | null> {
  const isFromContainer = options.docker || options.isDocker || false;
  for (const builder of TARGET_BUILDERS) {
    const target = await builder.getInfo({
      isFromContainer,
      scannedProject,
      packageInfo,
    });

    if (target) {
      const remoteUrl = options['remote-repo-url'];

      if (!remoteUrl) {
        return target;
      }

      if (typeof remoteUrl !== 'string') {
        throw new InvalidRemoteUrlError();
      }
      return { ...target, remoteUrl };
    }
  }

  return null;
}
