import { IacOutputMeta } from '../../../types';
import config from '../../../config';
import { EOL } from 'os';
import { colors, contentPadding } from './utils';

export function formatShareResultsOutput(iacOutputMeta: IacOutputMeta) {
  let projectName: string = iacOutputMeta.projectName;

  if (iacOutputMeta.gitRemoteUrl) {
    // from "http://github.com/snyk/cli.git" to "snyk/cli"
    projectName = iacOutputMeta.gitRemoteUrl.replace(
      /^https?:\/\/github.com\/(.*)\.git$/,
      '$1',
    );
  }

  return (
    colors.title('Report Complete') +
    EOL +
    EOL +
    contentPadding +
    'Your test results are available at: ' +
    colors.title(`${config.ROOT}/org/${iacOutputMeta.orgName}/project`) +
    EOL +
    contentPadding +
    'under the name: ' +
    colors.title(projectName)
  );
}

export const shareResultsTip =
  colors.title('Tip') +
  EOL +
  EOL +
  contentPadding +
  'New: Share your test results in the Snyk Web UI with the option ' +
  colors.title('--report');

export const shareCustomRulesDisclaimer =
  contentPadding +
  colors.suggestion(
    'Please note that your custom rules will not be sent to the platform, and will not be available on the projects page.',
  );
