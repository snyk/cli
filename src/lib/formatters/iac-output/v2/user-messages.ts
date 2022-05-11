import { IaCTestFlags } from '../../../../cli/commands/test/iac/local-execution/types';
import { colors } from './color-utils';

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
 * Displayed when a test fails.
 */
export const spinnerFailureMessage = colors.info(
  'Unable to complete the test.',
);

/**
 * @returns whether or not to include user messages in the output.
 */
export function shouldLogUserMessages(
  options: IaCTestFlags,
  iacCliOutputFeatureFlag?: boolean,
): boolean {
  return !!(
    !options.json &&
    !options.sarif &&
    !options.quiet &&
    iacCliOutputFeatureFlag
  );
}
