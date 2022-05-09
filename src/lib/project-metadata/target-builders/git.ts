import * as url from 'url';
import subProcess = require('../../sub-process');
import { GitTarget } from '../types';

// for scp-like syntax [user@]server:project.git
const originRegex = /(.+@)?(.+):(.+$)/;

export async function getInfo({
  isFromContainer,
  cwd,
}: {
  isFromContainer: boolean;
  cwd?: string;
}): Promise<GitTarget | null> {
  // safety check
  if (isFromContainer) {
    return null;
  }

  const target: GitTarget = {};

  try {
    const origin: string | null | undefined = (
      await subProcess.execute('git', ['remote', 'get-url', 'origin'], { cwd })
    ).trim();

    if (origin) {
      const { protocol, host, pathname = '' } = url.parse(origin);

      // Not handling git:// as it has no connection options
      if (host && protocol && ['ssh:', 'http:', 'https:'].includes(protocol)) {
        // same format for parseable URLs
        target.remoteUrl = `http://${host}${pathname}`;
      } else {
        const originRes = originRegex.exec(origin);
        if (originRes && originRes[2] && originRes[3]) {
          target.remoteUrl = `http://${originRes[2]}/${originRes[3]}`;
        } else {
          // else keep the original
          target.remoteUrl = origin;
        }
      }
    }
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  try {
    target.branch = (
      await subProcess.execute('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd,
      })
    ).trim();
  } catch (err) {
    // Swallowing exception since we don't want to break the monitor if there is a problem
    // executing git commands.
  }

  return target;
}
