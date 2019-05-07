import fs = require('fs');
import GitUrlParse = require('git-url-parse');

import subProcess = require('../../sub-process');
import { GitTarget } from '../types';

export async function getInfo(packageInfo): Promise<GitTarget|null> {
  let origin: string|null|undefined;

  if (packageInfo.docker) {
    return null;
  }

  try {
    origin = (await subProcess.execute('git', ['remote', 'get-url', 'origin'])).trim();

    if (!origin) {
      return null;
    }

    const parsedOrigin = GitUrlParse(origin);
    const branch = (await subProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();

    return {
      remoteUrl: parsedOrigin.toString('http'),
      branch,
    };
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
    return null;
  }
}
