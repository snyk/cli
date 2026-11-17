import * as os from 'os';
import auth from '../../../../../../src/cli/commands/auth';
import { makeRequest } from '../../../../../../src/lib/request';

jest.mock('../../../../../../src/lib/request', () => ({
  makeRequest: jest.fn(),
}));
jest.mock('../../../../../../src/lib/is-docker', () => ({
  isDocker: () => false,
}));
jest.mock('../../../../../../src/lib/is-ci', () => ({
  isCI: () => false,
}));
jest.mock('../../../../../../src/lib', () => ({
  config: { set: jest.fn() },
}));
jest.mock('open', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const openMock = jest.requireMock('open').default as jest.Mock;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
  openMock.mockResolvedValue(undefined);
  (makeRequest as unknown as jest.Mock).mockImplementation(
    (_payload, callback?) => {
      if (!callback) {
        return Promise.resolve({});
      }
      callback(
        null,
        { statusCode: 200, body: { api: 'token' } },
        {
          api: 'token',
        },
      );
    },
  );
});

afterEach(() => {
  jest.restoreAllMocks();
  openMock.mockReset();
  delete process.env.SNYK_UTM_MEDIUM;
  delete process.env.SNYK_UTM_SOURCE;
  delete process.env.SNYK_UTM_CAMPAIGN;
});

test('webAuth opens the login page and does not leak a failed open() rejection', async () => {
  // Arrange
  const unhandled = jest.fn();
  process.on('unhandledRejection', unhandled);
  openMock.mockRejectedValueOnce(new Error('no browser available'));

  // Act
  let message: string;
  try {
    message = await auth('');
    // open() is called from a setTimeout, so wait for it to run.
    await new Promise((resolve) => setTimeout(resolve, 10));
  } finally {
    process.off('unhandledRejection', unhandled);
  }

  // Assert
  expect(message).toContain('authenticated');
  expect(openMock).toHaveBeenCalledWith(
    expect.stringContaining('/login?token='),
  );
  expect(unhandled).not.toHaveBeenCalled();
});

test('webAuth passes UTM parameters from environment variables to the login URL', async () => {
  // Arrange
  process.env.SNYK_UTM_MEDIUM = 'ide';
  process.env.SNYK_UTM_SOURCE = 'eclipse';
  process.env.SNYK_UTM_CAMPAIGN = 'plugin';
  const utmParams = 'utm_medium=ide&utm_source=eclipse&utm_campaign=plugin';

  // Act
  await auth('');
  // open() is called from a setTimeout, so wait for it to run.
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Assert
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining(utmParams));
  expect(openMock).toHaveBeenCalledWith(
    expect.stringContaining('&' + utmParams),
  );
});

test('webAuth falls back to default UTM parameters with OS and docker', async () => {
  // Arrange
  jest.spyOn(os, 'type').mockReturnValue('Darwin');
  const utmParams =
    'utm_medium=cli&utm_source=cli&utm_campaign=cli&os=darwin&docker=false';

  // Act
  await auth('');
  // open() is called from a setTimeout, so wait for it to run.
  await new Promise((resolve) => setTimeout(resolve, 10));

  // Assert
  expect(console.log).toHaveBeenCalledWith(expect.stringContaining(utmParams));
  expect(openMock).toHaveBeenCalledWith(
    expect.stringContaining('&' + utmParams),
  );
});
