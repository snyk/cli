import { DangerRule } from './types';

const requireGeneratingHelpFiles: DangerRule = ({ danger, fail }) => {
  const modifiedHelpFiles =
    danger.git.modified_files.some((f) =>
      f.startsWith('help/commands-docs/'),
    ) ||
    danger.git.created_files.some((f) => f.startsWith('help/commands-docs/'));
  const modifiedGeneratedHelpFiles =
    danger.git.modified_files.some((f) => f.startsWith('help/commands-txt/')) ||
    danger.git.created_files.some((f) => f.startsWith('help/commands-txt/'));

  if (modifiedHelpFiles && !modifiedGeneratedHelpFiles) {
    fail(
      "You've modified help files in /help/commands-docs. You need to regenerate manpages locally by running `npm run generate-help` and commiting the changed files. See [README in /help for more details](https://github.com/snyk/snyk/blob/master/help/README.md)",
    );
  }
};

export { requireGeneratingHelpFiles as rule };
