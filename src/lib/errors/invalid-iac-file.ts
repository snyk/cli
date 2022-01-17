import chalk from 'chalk';
import { CustomError } from './custom-error';

export function NotSupportedIacFileErrorMsg(fileName: string): string {
  return (
    'Not supported infrastructure as code target files in ' +
    fileName +
    '.\nPlease see our documentation for supported target files: ' +
    chalk.underline(
      'https://docs.snyk.io/products/snyk-infrastructure-as-code/scan-kubernetes-configuration-files/scan-and-fix-security-issues-in-kubernetes-configuration-files',
    ) +
    ' and make sure you are in the right directory.'
  );
}

export function IllegalIacFileErrorMsg(fileName: string): string {
  return (
    'Illegal infrastructure as code target file ' +
    fileName +
    '.\nPlease see our documentation for supported target files: ' +
    chalk.underline(
      'https://docs.snyk.io/products/snyk-infrastructure-as-code/scan-kubernetes-configuration-files/scan-and-fix-security-issues-in-kubernetes-configuration-files',
    ) +
    ' and make sure you are in the right directory.'
  );
}

export function NotSupportedIacFileError(fileName: string): CustomError {
  const errorMsg = NotSupportedIacFileErrorMsg(fileName);
  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function IllegalIacCustomError(fileName: string): CustomError {
  const errorMsg = IllegalIacFileErrorMsg(fileName);
  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function InvalidK8SFileError(errorMsg: string): CustomError {
  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function IllegalTerraformFileError(
  atLocations: string[],
  reason: string,
): CustomError {
  const locationsStr = atLocations.join(', ');
  const errorMsg =
    `Illegal Terraform target file ${locationsStr} \nValidation Error Reason: ${reason}` +
    '.\nPlease see our documentation for supported target files: ' +
    chalk.underline(
      'https://support.snyk.io/hc/en-us/articles/360013723877-Test-your-Terraform-files-with-our-CLI-tool',
    ) +
    ' and make sure you are in the right directory.';

  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}

export function NotSupportedIacAllProjects(path: string): CustomError {
  const errorMsg =
    `Infrastructure as Code test does not support the "--all-projects" flag.\n` +
    `Directories with multiple IaC files can be tested using "snyk iac test ${path}" command.`;
  const error = new CustomError(errorMsg);
  error.code = 422;
  error.userMessage = errorMsg;
  return error;
}
