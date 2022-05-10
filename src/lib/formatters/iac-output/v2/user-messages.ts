import { IaCTestFlags } from '../../../../cli/commands/test/iac/local-execution/types';
import { colors } from './color-utils';

/**
 * Progress indication message while files are tested.
 */
export const spinnerMessage = colors.info.bold(
  'Snyk testing Infrastructure as Code configuration issues...',
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
