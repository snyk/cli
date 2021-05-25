import * as depcheck from 'depcheck';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';
import { config } from '../check-dependencies.config';

const checkDependencies = async () => {
  let exitCode = 0;

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  console.log();
  console.log('-'.repeat(32));
  console.log();

  for (const workspaceGlob of packageJson.workspaces) {
    const workspacePaths = glob.sync(workspaceGlob).map((p) => path.resolve(p));
    for (const workspacePath of workspacePaths) {
      console.log(`Checking ${workspacePath}`);
      const workspaceResults = await depcheck(workspacePath, config);
      const missingDependencies = Object.entries(workspaceResults.missing);
      const hasProblems =
        workspaceResults.dependencies.length > 0 ||
        workspaceResults.devDependencies.length > 0 ||
        missingDependencies.length > 0;

      if (hasProblems) {
        exitCode = 1;

        if (workspaceResults.dependencies.length > 0) {
          console.log(
            `\n  ${workspaceResults.dependencies.length} Unused Production Dependencies`,
          );
          for (const packageName of workspaceResults.dependencies) {
            console.log(`    - ${packageName}`);
          }
        }

        if (workspaceResults.devDependencies.length > 0) {
          console.log(
            `\n  ${workspaceResults.devDependencies.length} Unused Development Dependencies`,
          );
          for (const packageName of workspaceResults.devDependencies) {
            console.log(`    - ${packageName}`);
          }
        }

        if (missingDependencies.length > 0) {
          console.log(`\n  ${missingDependencies.length} Missing Dependencies`);
          for (const [packageName, dependentFiles] of missingDependencies) {
            console.log(`    - ${packageName}`);
            for (const file of dependentFiles) {
              console.log(`      > ${file}`);
            }
          }
        }
      } else {
        console.log('\n ✓ No problems found.');
      }

      console.log();
      console.log('-'.repeat(32));
      console.log();
    }
  }

  if (exitCode !== 0) {
    console.log(
      'Problems found. See output above.\n',
      '  If you think a package is wrongly flagged:\n',
      '    1. Add it to ./check-dependencies.config.ts\n',
      '    2. Provide a reason next to it.',
    );
    process.exit(exitCode);
  }

  console.log('No problems found.');
};

checkDependencies();
