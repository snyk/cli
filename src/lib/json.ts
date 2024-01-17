const debug = require('debug')('snyk-json');

/**
 * Attempt to json-stringify an object which is potentially very large and might exceed the string limit.
 * If it does exceed the string limit, try again without pretty-print to hopefully come out below the string limit.
 * @param obj the object from which you want to get a JSON string
 */
export function jsonStringifyLargeObject(obj: any): string {
  let res = '';
  try {
    // first try pretty-print
    res = JSON.stringify(obj, null, 2);
    return res;
  } catch (err) {
    debug('JSON.stringify failed - try using --json-file-output=<filePath> for very large objects', err);
    return res;
  }
}
