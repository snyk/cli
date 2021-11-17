import { icon } from '../../src/lib/theme';
import { checkDependencies, hasProblems } from './lib';

async function checkDependenciesAsPlainText() {
  console.log();
  console.log('-'.repeat(32));
  console.log();

  for await (const next of checkDependencies()) {
    if (typeof next === 'string') {
      const workspacePath = next;
      console.log(`Checking ${workspacePath}`);
      continue;
    }

    const result = next;
    if (hasProblems(result)) {
      process.exitCode = 1;

      if (result.dependencies.length > 0) {
        console.log(
          `\n  ${result.dependencies.length} Unused Production Dependencies`,
        );
        for (const packageName of result.dependencies) {
          console.log(`    - ${packageName}`);
        }
      }

      if (result.devDependencies.length > 0) {
        console.log(
          `\n  ${result.devDependencies.length} Unused Development Dependencies`,
        );
        for (const packageName of result.devDependencies) {
          console.log(`    - ${packageName}`);
        }
      }

      if (result.missingDependencies.length > 0) {
        console.log(
          `\n  ${result.missingDependencies.length} Missing Dependencies`,
        );
        for (const { name, files } of result.missingDependencies) {
          console.log(`    - ${name}`);
          for (const file of files) {
            console.log(`      > ${file}`);
          }
        }
      }
    } else {
      console.log(`\n ${icon.VALID} No problems found.`);
    }

    console.log();
    console.log('-'.repeat(32));
    console.log();
  }

  if (process.exitCode) {
    console.log(
      'Problems found. See output above.\n',
      '  If you think a package is wrongly flagged:\n',
      '    1. Add it to ./check-dependencies.config.ts\n',
      '    2. Provide a reason next to it.',
    );
  } else {
    console.log('No problems found.');
  }
}

checkDependenciesAsPlainText();
