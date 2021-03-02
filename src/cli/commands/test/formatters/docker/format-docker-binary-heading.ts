const values = require('lodash.values');
import chalk from 'chalk';

export function createDockerBinaryHeading(pkgInfo): string {
  const binaryName = pkgInfo.pkg.name;
  const binaryVersion = pkgInfo.pkg.version;
  const numOfVulns = values(pkgInfo.issues).length;
  const vulnCountText = numOfVulns > 1 ? 'vulnerabilities' : 'vulnerability';
  return numOfVulns
    ? chalk.bold.white(
        `------------ Detected ${numOfVulns} ${vulnCountText}` +
          ` for ${binaryName}@${binaryVersion} ------------`,
        '\n',
      )
    : '';
}
