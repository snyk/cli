import * as gitTargetBuilder from './target-builders/git';
import * as containerTargetBuilder from './target-builders/container';
import { GitTarget, ContainerTarget } from './types';
import { DepTree } from '../types';
import { InvalidRemoteUrlError } from '../errors/invalid-remote-url-error';

const TARGET_BUILDERS = [containerTargetBuilder, gitTargetBuilder];
interface Options {
  'remote-repo-url'?: string;
}

export async function getInfo(
  packageInfo: DepTree,
  options: Options,
): Promise<GitTarget | ContainerTarget | null> {
  for (const builder of TARGET_BUILDERS) {
    const target = await builder.getInfo(packageInfo);

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
