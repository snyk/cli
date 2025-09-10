import {
  getBaseApiUrl,
  getV1ApiUrl,
  getRestApiUrl,
  getRootUrl,
  getAppUrl,
} from '../../../../src/lib/config/api-url';

const urls = [
  {
    userInput: 'https://snyk.io/api/v1',
    expectedBase: 'https://snyk.io/api/',
    expectedV1: 'https://snyk.io/api/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://snyk.io',
    expectedApp: 'https://snyk.io',
  },
  {
    userInput: 'https://snyk.io/api',
    expectedBase: 'https://snyk.io/api',
    expectedV1: 'https://snyk.io/api/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://snyk.io',
    expectedApp: 'https://snyk.io',
  },
  {
    userInput: 'https://app.snyk.io/api',
    expectedBase: 'https://app.snyk.io/api',
    expectedV1: 'https://app.snyk.io/api/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://app.snyk.io',
    expectedApp: 'https://app.snyk.io',
  },
  {
    userInput: 'https://app.snyk.io/api/v1',
    expectedBase: 'https://app.snyk.io/api/',
    expectedV1: 'https://app.snyk.io/api/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://app.snyk.io',
    expectedApp: 'https://app.snyk.io',
  },
  {
    userInput: 'https://api.snyk.io/v1',
    expectedBase: 'https://api.snyk.io/',
    expectedV1: 'https://api.snyk.io/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://snyk.io',
    expectedApp: 'https://app.snyk.io',
  },
  {
    userInput: 'https://api.snyk.io',
    expectedBase: 'https://api.snyk.io',
    expectedV1: 'https://api.snyk.io/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://snyk.io',
    expectedApp: 'https://app.snyk.io',
  },
  {
    userInput: 'https://api.snyk.io/',
    expectedBase: 'https://api.snyk.io/',
    expectedV1: 'https://api.snyk.io/v1',
    expectedRest: 'https://api.snyk.io/rest',
    expectedRoot: 'https://snyk.io',
    expectedApp: 'https://app.snyk.io',
  },
  {
    userInput: 'https://api.custom.snyk.io',
    expectedBase: 'https://api.custom.snyk.io',
    expectedV1: 'https://api.custom.snyk.io/v1',
    expectedRest: 'https://api.custom.snyk.io/rest',
    expectedRoot: 'https://custom.snyk.io',
    expectedApp: 'https://app.custom.snyk.io',
  },
  {
    userInput: 'http://localhost:9000/',
    expectedBase: 'http://localhost:9000/',
    expectedV1: 'http://localhost:9000/v1',
    expectedRest: 'http://localhost:9000/rest',
    expectedRoot: 'http://localhost:9000',
    expectedApp: 'http://localhost:9000',
  },
  {
    userInput: 'http://localhost:9000/api/v1',
    expectedBase: 'http://localhost:9000/api/',
    expectedV1: 'http://localhost:9000/api/v1',
    expectedRest: 'http://localhost:9000/rest',
    expectedRoot: 'http://localhost:9000',
    expectedApp: 'http://localhost:9000',
  },
  {
    userInput: 'http://alpha:omega@localhost:9000',
    expectedBase: 'http://alpha:omega@localhost:9000',
    expectedV1: 'http://alpha:omega@localhost:9000/v1',
    expectedRest: 'http://alpha:omega@localhost:9000/rest',
    expectedRoot: 'http://localhost:9000',
    expectedApp: 'http://localhost:9000',
  },
  {
    userInput: 'https://app.dev.snyk.io/api/v1',
    expectedBase: 'https://app.dev.snyk.io/api/',
    expectedV1: 'https://app.dev.snyk.io/api/v1',
    expectedRest: 'https://api.dev.snyk.io/rest',
    expectedRoot: 'https://app.dev.snyk.io',
    expectedApp: 'https://app.dev.snyk.io',
  },
];

describe('CLI config - API URL', () => {
  // TODO: check that console.error was called for error states?
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getBaseApiUrl', () => {
    describe('when only default URL is defined', () => {
      urls.forEach((url) => {
        it(`returns default API URL ${url.userInput} without the v1 suffix`, () => {
          expect(getBaseApiUrl(url.userInput)).toEqual(url.expectedBase);
        });
      });
    });

    it('returns envvar API if it is defined and valid', () => {
      expect(
        getBaseApiUrl('https://api.snyk.io/', 'http://localhost:9000/'),
      ).toEqual('http://localhost:9000/');
      expect(
        getBaseApiUrl(
          'https://api.snyk.io/',
          'http://alpha:omega@localhost:9000/',
          'https://endpoint-api.snyk.io/',
        ),
      ).toEqual('http://alpha:omega@localhost:9000/');
    });

    it('returns default API if envvar is defined but not valid', () => {
      expect(getBaseApiUrl('https://api.snyk.io/', 'localhost:10')).toEqual(
        'https://api.snyk.io/',
      );
    });

    it('returns config API if it is defined and valid', () => {
      expect(
        getBaseApiUrl(
          'https://api.snyk.io/',
          undefined,
          'http://localhost:9000/',
        ),
      ).toEqual('http://localhost:9000/');
      expect(
        getBaseApiUrl(
          'https://api.snyk.io/',
          undefined,
          'http://alpha:omega@localhost:9000/',
        ),
      ).toEqual('http://alpha:omega@localhost:9000/');
    });

    it('returns default API if config endpoint is defined but not valid', () => {
      expect(
        getBaseApiUrl('https://api.snyk.io/', undefined, 'localhost:10'),
      ).toEqual('https://api.snyk.io/');
    });
  });

  describe('getV1ApiUrl', () => {
    urls.forEach((url) => {
      it(`returns V1 API URL ${url.expectedBase} with v1 path`, () => {
        expect(getV1ApiUrl(url.expectedBase)).toEqual(url.expectedV1);
      });
    });
  });

  describe('getRestApiUrl', () => {
    urls.forEach((url) => {
      it(`returns REST API URL ${url.expectedBase}`, () => {
        expect(getRestApiUrl(url.expectedBase)).toEqual(url.expectedRest);
      });
    });
  });

  describe('getRootUrl', () => {
    urls.forEach((url) => {
      it(`returns ROOT URL ${url.userInput}`, () => {
        expect(getRootUrl(url.userInput)).toEqual(url.expectedRoot);
      });
    });
  });

  describe('getAppUrl', () => {
    urls.forEach((url) => {
      it(`returns ROOT URL ${url.userInput}`, () => {
        expect(getAppUrl(url.userInput)).toEqual(url.expectedApp);
      });
    });
  });
});
