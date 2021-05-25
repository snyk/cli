import * as depcheck from 'depcheck';
import * as fs from 'fs';
import * as path from 'path';
import * as glob from 'glob';

const checkDependencies = async () => {
  let exitCode = 0;

  const options: depcheck.Options = {
    ignoreMatches: [
      'sarif', // we only use @types/sarif. https://github.com/depcheck/depcheck/issues/640
      '@types/jest', // jest is a global so impossible to detect usage of types
    ],
    ignoreDirs: ['node_modules', 'dist', 'fixtures', 'test-output'],
  };

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));

  console.log();
  console.log('-'.repeat(32));
  console.log();

  for (const workspaceGlob of packageJson.workspaces) {
    const workspacePaths = glob.sync(workspaceGlob).map((p) => path.resolve(p));
    for (const workspacePath of workspacePaths) {
      console.log(`Checking ${workspacePath}`);
      const workspaceResults = await depcheck(workspacePath, options);
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
    console.log('Problems found. See output above.');
    process.exit(exitCode);
  }

  console.log('No problems found.');
};

checkDependencies();
