import gitUrlParse = require('git-url-parse');

import subProcess = require('../../sub-process');
import { DepTree } from '../../types';
import { GitTarget } from '../types';

export async function getInfo(packageInfo: DepTree): Promise<GitTarget | null> {
  if (packageInfo.docker) {
    return null;
  }

  const target: GitTarget = {};

  try {
    const origin: string | null | undefined = (
      await subProcess.execute('git', ['remote', 'get-url', 'origin'])
    ).trim();

    if (origin) {
      const parsedOrigin = gitUrlParse(origin);
      target.remoteUrl = parsedOrigin.toString('http');
    }
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  try {
    target.branch = (
      await subProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    ).trim();
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  return target;
}
