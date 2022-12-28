import {
  trackUsage,
  TestLimitReachedError,
} from '../../../../src/cli/commands/test/iac/local-execution/usage-tracking';
import { mocked } from 'ts-jest/utils';
import { NeedleResponse } from 'needle';
import { makeRequest } from '../../../../src/lib/request/request';
import { CustomError } from '../../../../src/lib/errors';

jest.mock('../../../../src/lib/request/request');
const mockedMakeRequest = mocked(makeRequest);

const results = [
  {
    meta: {
      isPrivate: true,
    },
    result: {
      cloudConfigResults: ['an issue'],
    },
  },
  {
    meta: {
      isPrivate: false,
    },
    result: {
      cloudConfigResults: [],
    },
  },
];

const org = 'test-org';

describe('tracking IaC test usage', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not throw an error when backend returns HTTP 200', async () => {
    mockedMakeRequest.mockImplementationOnce(() => {
      return Promise.resolve({
        res: { statusCode: 200 } as NeedleResponse,
        body: {
          foo: 'bar',
        },
      });
    });

    await trackUsage(results, org);

    expect(mockedMakeRequest.mock.calls.length).toEqual(1);
    expect(mockedMakeRequest.mock.calls[0][0].qs).toEqual({ org });
    expect(mockedMakeRequest.mock.calls[0][0].body).toEqual({
      results: [
        {
          isPrivate: true,
          issuesPrevented: 1,
        },
        {
          isPrivate: false,
          issuesPrevented: 0,
        },
      ],
    });
  });

  it('throws TestLimitReachedError when backend returns HTTP 429', async () => {
    mockedMakeRequest.mockImplementationOnce(() => {
      return Promise.resolve({
        res: { statusCode: 429 } as NeedleResponse,
        body: {
          foo: 'bar',
        },
      });
    });

    await expect(trackUsage(results, org)).rejects.toThrow(
      new TestLimitReachedError(),
    );
  });

  it('throws CustomError when backend returns HTTP 500', async () => {
    mockedMakeRequest.mockImplementationOnce(() => {
      return Promise.resolve({
        res: { statusCode: 500, body: { foo: 'bar' } } as NeedleResponse,
        body: {
          foo: 'bar',
        },
      });
    });

    await expect(trackUsage(results, org)).rejects.toThrow(
      new CustomError(
        'An error occurred while attempting to track test usage: {"foo":"bar"}',
      ),
    );
  });
});
