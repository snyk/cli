// This check can be removed once the project upgrades to node 24 or above
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Read the version of the npm that is actually running this lifecycle script.
function resolveNpmVersion(): string | undefined {
  const execpath = process.env.npm_execpath;
  if (execpath) {
    try {
      const pkgPath = join(dirname(execpath), '..', 'package.json');
      const { version } = JSON.parse(readFileSync(pkgPath, 'utf8'));
      if (typeof version === 'string') return version;
    } catch {
      // fall through to user-agent
    }
  }
  const ua = process.env.npm_config_user_agent || '';
  return ua.match(/npm\/(\d+\.\d+\.\d+)/)?.[1];
}

const currentNpm = resolveNpmVersion();
const match = currentNpm?.match(/^(\d+)\.(\d+)\.(\d+)$/);

if (!match) {
  console.error(
    'Failed to verify npm version (could not resolve running npm).',
  );
  process.exit(1);
}

const major = Number(match[1]);
const minor = Number(match[2]);

// npm versions prior to 11.10 do not enforce "min-release-age"
if (major < 11 || (major === 11 && minor < 10)) {
  console.error('\x1b[31m%s\x1b[0m', '[ERROR] Project requires npm >= 11.10');
  console.error(`[ERROR] Your current version is: ${currentNpm}`);
  console.error('Please upgrade your npm before running install:');
  console.error('\x1b[32m%s\x1b[0m', ' npm install -g npm@latest\n');
  process.exit(1);
}
