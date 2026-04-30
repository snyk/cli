import subProcess = require('../../sub-process');
import { GitTarget } from '../types';
import * as debugModule from 'debug';

const debug = debugModule('snyk:git');

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
      let parsedOrigin: URL | undefined;
      try {
        parsedOrigin = new URL(origin);
      } catch {
        parsedOrigin = undefined;
      }

      // Not handling git:// as it has no connection options
      if (
        parsedOrigin &&
        parsedOrigin.host &&
        parsedOrigin.protocol &&
        ['ssh:', 'http:', 'https:'].includes(parsedOrigin.protocol)
      ) {
        const pathname = parsedOrigin.pathname || '';
        // url.parse().host equivalent: hostname plus port if non-default
        target.remoteUrl = `http://${parsedOrigin.host}${pathname}`;
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
    debug('getInfo error getting target remoteUrl:', err);
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
    debug('getInfo error getting target branch:', err);
  }

  return target;
}
