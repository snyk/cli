import { EOL } from 'os';
import { colors, contentPadding } from './utils';
import { getAppUrl } from '../../../config/api-url';
import config from '../../../config';

const apiUrl = config.API;

export function formatShareResultsOutput(orgName: string, projectName: string) {
  return (
    colors.title('Report Complete') +
    EOL +
    EOL +
    contentPadding +
    'Your test results are available at: ' +
    colors.title(`${getAppUrl(apiUrl)}/org/${orgName}/projects`) +
    EOL +
    contentPadding +
    'under the name: ' +
    colors.title(projectName)
  );
}

export function formatShareResultsOutputIacPlus(
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
      `${getAppUrl(apiUrl)}/org/${orgName}/cloud/issues?environment_name=${encodeURIComponent(
        projectName,
      )}`,
    )
  );
}

export function formatShareResultsOutputIacV2(
  orgName: string,
  projectPublicId: string | undefined,
) {
  let projectLink = ''; // empty link if projectId is undefined, will follow up on this after product decision
  if (projectPublicId) {
    projectLink = `${getAppUrl(apiUrl)}/org/${orgName}/project/${encodeURIComponent(projectPublicId)}`;
  }

  return (
    colors.title('Report Complete') +
    EOL +
    EOL +
    contentPadding +
    'Your test results are available at: ' +
    colors.title(projectLink)
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

export const shareResultsError =
  colors.title('Failed to create and display results in Snyk UI') +
  EOL +
  EOL +
  contentPadding +
  'There was a problem creating the project and displaying the test results in Snyk UI.' +
  EOL +
  contentPadding +
  colors.title('Need help?') +
  ' Check the Snyk CLI for IaC doc https://docs.snyk.io/snyk-cli/scan-and-maintain-projects-using-the-cli/snyk-cli-for-iac';
