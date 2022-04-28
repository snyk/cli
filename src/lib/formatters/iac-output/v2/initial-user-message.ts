import { IaCTestFlags } from '../../../../cli/commands/test/iac/local-execution/types';
import { colors } from './color-utils';

export const initalUserMessageOutput = colors.info.bold(
  'Snyk testing Infrastructure as Code configuration issues...',
);

export function shouldPrintIacInitialMessage(
  options: IaCTestFlags,
  iacCliOutputFeatureFlag?: boolean,
): boolean {
  return !!(!options.json && !options.sarif && iacCliOutputFeatureFlag);
}
