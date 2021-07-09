import * as wrap from 'wrap-ansi';
import chalk from 'chalk';

import { LegalInstruction } from '../../lib/snyk-test/legacy';


export function formatLegalInstructions(
  legalInstructions: LegalInstruction[],
  paddingLength = 4,
): string {
  const legalContent: string[] = legalInstructions.map((legalData) =>
    wrap(
      chalk.bold(`○ for ${legalData.licenseName}: `) + legalData.legalContent,
      100,
    )
      .split('\n')
      .join('\n' + ' '.repeat(paddingLength)),
  );
  return legalContent.join('\n' + ' '.repeat(paddingLength));
}
