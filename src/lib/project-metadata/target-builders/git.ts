import fs = require('fs');
import GitUrlParse = require('git-url-parse');

import subProcess = require('../../sub-process');
import { GitTarget } from '../types';

export async function getInfo(packageInfo): Promise<GitTarget | null> {
  let origin: string | null | undefined;
  if (packageInfo.docker) {
    return null;
  }

  const target: GitTarget = {};

  try {
    origin = (
      await subProcess.execute('git', ['remote', 'get-url', 'origin'])
    ).trim();

    if (origin) {
      const parsedOrigin = GitUrlParse(origin);
      target.remoteUrl = parsedOrigin.toString('http');
    }
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  try {
    const branch = (
      await subProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
    ).trim();

    target.branch = branch;
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  return target;
}
