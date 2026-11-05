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
