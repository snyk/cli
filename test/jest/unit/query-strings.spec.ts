/* eslint-disable @typescript-eslint/camelcase */
import * as url from 'url';
import { getQueryParamsAsString } from '../../../src/lib/query-strings';

describe('Query strings', () => {
  it('returns a string', () => {
    expect(typeof getQueryParamsAsString([])).toBe('string');
  });

  it("returns a string that's a valid URL query string", () => {
    // Object.fromEntries is not available for Node 8 and 10. Testing this in latest Node is enough
    if (Object.fromEntries) {
      expect(
        Object.fromEntries(new url.URLSearchParams(getQueryParamsAsString([]))),
      ).toStrictEqual({
        utm_medium: 'cli',
        utm_source: 'cli',
        utm_campaign: 'cli',
        os: expect.any(String),
        docker: expect.any(String),
      });
    }
  });

  it('uses integration name and version', () => {
    process.env.SNYK_INTEGRATION_NAME = 'NPM';
    process.env.SNYK_INTEGRATION_VERSION = '1.2.3';

    // Object.fromEntries is not available for Node 8 and 10. Testing this in latest Node is enough
    if (Object.fromEntries) {
      expect(
        Object.fromEntries(new url.URLSearchParams(getQueryParamsAsString([]))),
      ).toStrictEqual({
        utm_source: 'cli',
        utm_medium: 'cli',
        utm_campaign: 'NPM',
        utm_campaign_content: '1.2.3',
        os: expect.any(String),
        docker: expect.any(String),
      });
    }

    delete process.env.SNYK_INTEGRATION_NAME;
    delete process.env.SNYK_INTEGRATION_VERSION;
  });
});
