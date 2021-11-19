import { contactSupportMessage, reTryMessage } from '../common';

export function summariseErrorResults(errorResultsLength: number): string {
  const projects = errorResultsLength > 1 ? 'projects' : 'project';
  if (errorResultsLength > 0) {
    return ` Failed to test ${errorResultsLength} ${projects}.\n${reTryMessage}\n${contactSupportMessage}`;
  }

  return '';
}
