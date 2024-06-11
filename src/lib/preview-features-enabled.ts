const debug = require('debug')('preview');

export function previewFeaturesEnabled(): boolean {
  if (process.env.SNYK_INTERNAL_PREVIEW_FEATURES === '1') {
    debug('Using a preview feature!');
    return true;
  }
  return false;
}
