const debug = require('debug')('snyk-json');

/**
 * Attempt to json-stringify an object which is potentially very large and might exceed the string limit.
 * If it does exceed the string limit, return empty string.
 * @param obj the object from which you want to get a JSON string
 * @deprecated Don't use this, it can exceed max string length.
 */
export function jsonStringifyLargeObject(obj: any): string {
  let res = '';
  try {
    res = JSON.stringify(obj, null, 2);
    return res;
  } catch (err) {
    debug('jsonStringifyLargeObject failed: ', err);
    return res;
  }
}
