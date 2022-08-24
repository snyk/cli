import { IaCTestFlags } from '../../../../cli/commands/test/iac/local-execution/types';
import { colors } from './utils';

/**
 * Displayed as the title of the test output.
 */
export const iacTestTitle = colors.info.bold('Snyk Infrastructure as Code');

/**
 * Progress indication message while files are tested.
 */
export const spinnerMessage = colors.info(
  'Snyk testing Infrastructure as Code configuration issues.',
);

/**
 * Displayed when a test resolves successfully.
 */
export const spinnerSuccessMessage = colors.info('Test completed.');

/**
 * Message for using custom rules.
 */
export const customRulesMessage = colors.info(
  'Using custom rules to generate misconfigurations.',
);

/**
 * Message for using custom rules.
 */
export const customRulesReportMessage = colors.info(
  "Please note that your custom rules will not be sent to the Snyk platform, and will not be available on the project's page.",
);

/**
 * @returns whether or not to include user messages in the output.
 */
export function shouldLogUserMessages(options: IaCTestFlags): boolean {
  return !options.json && !options.sarif && !options.quiet;
}
