const URL_REGEX = /^((?:https?:\/\/)?[^./]+(?:\.[^./]+)+(?:\/.*)?)$/;

/**
 * Checks if the provided URL string is valid.
 */
export function isValidUrl(urlStr: string): boolean {
  return URL_REGEX.test(urlStr);
}
