import config from '../../../config';
import { EOL } from 'os';
import { colors, contentPadding } from './utils';

export function formatShareResultsOutput(orgName: string, projectName: string) {
  return (
    colors.title('Report Complete') +
    EOL +
    EOL +
    contentPadding +
    'Your test results are available at: ' +
    colors.title(`${config.ROOT}/org/${orgName}/projects`) +
    EOL +
    contentPadding +
    'under the name: ' +
    colors.title(projectName)
  );
}

export function formatShareResultsOutputV2(
  orgName: string,
  projectName: string,
) {
  return (
    colors.title('Report Complete') +
    EOL +
    EOL +
    contentPadding +
    'Your test results are available at: ' +
    colors.title(
      `${
        config.ROOT
      }/org/${orgName}/cloud/issues?environment_name=${encodeURIComponent(
        projectName,
      )}`,
    )
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
