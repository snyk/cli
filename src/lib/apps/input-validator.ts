import * as uuid from 'uuid';

/**
 *
 * @param {String} input of space separated URL/URI passed by
 * user for redirect URIs
 * @returns { String | Boolean } complying with inquirer return values, the function
 * separates the string on space and validates each to see
 * if a valid URL/URI. Return a string if invalid and
 * boolean true if valid
 */
export function validateAllURL(input: string): string | boolean {
  const trimmedInput = input.trim();
  let errMessage = '';
  for (const i of trimmedInput.split(',')) {
    if (typeof validURL(i) == 'string')
      errMessage = errMessage + `\n${validURL(i)}`;
  }

  if (errMessage) return errMessage;
  return true;
}

/**
 * Custom validation logic which takes in consideration
 * creation of Snyk Apps and thus allows localhost.com
 * as a valid URL.
 * @param {String} input of URI/URL value to validate using
 * regex
 * @returns {String | Boolean } string message is not valid
 * and boolean true if valid
 */
export function validURL(input: string): boolean | string {
  try {
    new URL(input);
    return true;
  } catch (error) {
    return `${input} is not a valid URL`;
  }
}

/**
 * Function validates if a valid UUID (version of UUID not tacken into account)
 * @param {String} input UUID to be validated
 * @returns {String | Boolean } string message is not valid
 * and boolean true if valid
 */
export function validateUUID(input: string): boolean | string {
  return uuid.validate(input) ? true : 'Invalid UUID provided';
}

/**
 * @param {String} input
 * @returns {String | Boolean } string message is not valid
 * and boolean true if valid
 */
export function validInput(input: string): string | boolean {
  if (!input) return 'Please enter something';
  return true;
}
