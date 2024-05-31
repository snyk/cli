import { JsonStreamStringify } from "json-stream-stringify";

const debug = require('debug')('snyk-json');

/**
 * writeJson writes a JSON representation of the given object to the given
 * stream.
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const writeJson = (obj: any, out: NodeJS.WritableStream): void => {
  const jsonStreamer = new JsonStreamStringify(obj);
  jsonStreamer.pipe(out);
}

/**
 * Attempt to json-stringify an object which is potentially very large and might exceed the string limit.
 * If it does exceed the string limit, return empty string.
 * @param obj the object from which you want to get a JSON string
 * @deprecated Don't use this function, use writeJson if the object can actually get large.
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
