import * as fs from 'fs';
import { DangerRule } from './types';

const recommendMigratingModuleSyntax: DangerRule = ({ danger, warn }) => {
  const filesUsingNodeJSImportExport = danger.git.modified_files
    .filter((filePath) => {
      if (filePath.endsWith('.js')) {
        return false;
      }
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return (
        fileContent.includes('module.exports') ||
        fileContent.includes('= require(')
      );
    })
    .map((filePath) => `- \`${filePath}\``)
    .join('\n');

  if (filesUsingNodeJSImportExport) {
    const message =
      "Since the CLI is unifying on a standard and improved tooling, we're starting to migrate old-style `import`s and `export`s to ES6 ones.\nA file you've modified is using either `module.exports` or `require()`. If you can, please update them to ES6 [import syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import) and [export syntax](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export).\n Files found:\n" +
      filesUsingNodeJSImportExport;
    warn(message);
  }
};

export { recommendMigratingModuleSyntax as rule };
