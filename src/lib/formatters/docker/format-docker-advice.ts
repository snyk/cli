import chalk from 'chalk';
import {
  TestResult,
  BaseImageRemediationAdvice,
} from '../../../lib/snyk-test/legacy';

export function dockerRemediationForDisplay(res: TestResult) {
  if (!res.docker || !res.docker.baseImageRemediation) {
    return '';
  }
  const { advice, message } = res.docker.baseImageRemediation;
  const out = [] as any[];

  if (advice) {
    for (const item of advice) {
      out.push(getTerminalStringFormatter(item)(item.message));
    }
  } else if (message) {
    out.push(message);
  } else {
    return '';
  }
  return `\n\n${out.join('\n')}`;
}

function getTerminalStringFormatter({
  color,
  bold,
}: BaseImageRemediationAdvice) {
  let formatter = chalk;
  if (color && formatter[color]) {
    formatter = formatter[color];
  }
  if (bold) {
    formatter = formatter.bold;
  }
  return formatter;
}
