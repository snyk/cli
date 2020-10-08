import {
  getIntegrationName,
  getIntegrationVersion,
  INTEGRATION_NAME_HEADER,
  INTEGRATION_VERSION_HEADER,
} from '../src/lib/analytics-sources';

const emptyArgs = [];

beforeEach(() => {
  delete process.env[INTEGRATION_NAME_HEADER];
  delete process.env[INTEGRATION_VERSION_HEADER];
});

describe('analytics-sources - getIntegrationName', () => {
  it('integration name is empty by default', () => {
    expect(getIntegrationName(emptyArgs)).toBe('');
  });

  it('integration name is loaded from envvar', () => {
    process.env[INTEGRATION_NAME_HEADER] = 'NPM';
    expect(getIntegrationName(emptyArgs)).toBe('NPM');

    process.env[INTEGRATION_NAME_HEADER] = 'STANDALONE';
    expect(getIntegrationName(emptyArgs)).toBe('STANDALONE');
  });

  it('integration name is empty when envvar is not recognized', () => {
    process.env[INTEGRATION_NAME_HEADER] = 'INVALID';
    expect(getIntegrationName(emptyArgs)).toBe('');
  });

  it('integration name is loaded and formatted from CLI flag', () => {
    expect(getIntegrationName([{ integrationName: 'homebrew' }])).toBe(
      'HOMEBREW',
    );
  });

  it('integration name is loaded and validated from CLI flag', () => {
    expect(getIntegrationName([{ integrationName: 'invalid' }])).toBe('');
  });
});

describe('analytics-sources - getIntegrationVersion', () => {
  it('integration version is empty by default', () => {
    expect(getIntegrationVersion(emptyArgs)).toBe('');
  });

  it('integration version is loaded from envvar', () => {
    process.env[INTEGRATION_VERSION_HEADER] = '1.2.3';
    expect(getIntegrationVersion(emptyArgs)).toBe('1.2.3');
  });

  it('integration version is loaded from CLI flag', () => {
    expect(
      getIntegrationVersion([{ integrationVersion: '1.2.3-Crystal' }]),
    ).toBe('1.2.3-Crystal');
  });
});
