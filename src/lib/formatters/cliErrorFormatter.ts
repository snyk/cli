import chalk from 'chalk';
import { getReasonPhrase } from 'http-status-codes';
import {ProblemError} from "@snyk/error-catalog-nodejs-public";

export function isErrorOfTypeProblemError(
  error: Error | ProblemError,
): error is ProblemError {
  return (error as ProblemError)?.isErrorCatalogError === true;
}
function successLogger(message: string) {
  console.log('🙌', chalk.bgGreen(' Awesome, No issues were found. '));
  console.log(message);
}
function errorLoggerFactory(logLevel: 'info' | 'warn' | 'error') {
  const createLogger = (color: string) => (
    error: ProblemError | Error,
    callback?: (err: Error) => void,
  ) => {
    if (isErrorOfTypeProblemError(error)) {
      const jsonResponse = error.toJsonApiErrorObject();
      let output = `${chalk[color](`${logLevel.toUpperCase()}  `)} ${chalk[
        color
      ](` ${jsonResponse.title}      `)}  (${jsonResponse.code}) \nInfo:   ${
        jsonResponse.detail
      } \nHTTP:   ${jsonResponse.status} ${getReasonPhrase(
        jsonResponse.status,
      )}`;
      if (jsonResponse.links) {
        output += `\nHelp:   ${jsonResponse.links.about}`;
      }
      return output;
    }
    if (callback) {
      return callback(error);
    }
  };
  const loglevelColorMap = {
    info: 'bgBlue',
    warn: 'bgYellow',
    error: 'bgRed',
  };
  return createLogger(loglevelColorMap[logLevel]);
}
export const cliOutputFormatter = {
  error: errorLoggerFactory('error'),
  warn: errorLoggerFactory('warn'),
  info: errorLoggerFactory('info'),
  success: successLogger,
};
