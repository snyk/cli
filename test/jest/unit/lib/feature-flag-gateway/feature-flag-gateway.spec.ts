import {
  evaluateFeatureFlagsForOrg,
  getEnabledFeatureFlags,
} from '../../../../../src/lib/feature-flag-gateway';
import config from '../../../../../src/lib/config';
import * as apiToken from '../../../../../src/lib/api-token';
import { makeRequest } from '../../../../../src/lib/request';
import {
  AuthFailedError,
  ValidationError,
} from '../../../../../src/lib/errors';
import { TestLimitReachedError } from '../../../../../src/cli/commands/test/iac/local-execution/usage-tracking';

jest.mock('../../../../../src/lib/request');

describe('feature-flag-gateway client', () => {
  const orgId = 'f1900900-3db1-4bed-b873-78f589d5a59c';
  const version = '2024-10-15';
  const makeRequestMock = makeRequest as unknown as jest.Mock;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('evaluateFeatureFlagsForOrg', () => {
    it('should POST to /hidden/orgs/:orgId/feature_flags/evaluation with version querystring and return parsed body', async () => {
      const flags = ['show-maven-build-scope', 'snykCode'];

      const mockRespBody = {
        data: {
          attributes: {
            evaluations: [
              { key: 'show-maven-build-scope', value: true, reason: 'found' },
              { key: 'snykCode', value: false, reason: 'found' },
            ],
            evaluatedAt: '2025-01-01T00:00:00Z',
          },
        },
      };

      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: mockRespBody,
      });

      const result = await evaluateFeatureFlagsForOrg(flags, orgId, version);

      expect(result).toEqual(mockRespBody);

      expect(makeRequestMock).toHaveBeenCalledTimes(1);
      const [payload] = makeRequestMock.mock.calls[0];

      expect(payload.url).toBe(
        `${config.API_HIDDEN_URL}/orgs/${encodeURIComponent(
          orgId,
        )}/feature_flags/evaluation?version=${encodeURIComponent(version)}`,
      );

      expect(payload).toEqual(
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/vnd.api+json',
            Authorization: 'token test-token',
          },
          json: true,
          noCompression: true,
        }),
      );

      expect(payload.body).toEqual(
        expect.objectContaining({
          data: {
            type: 'feature_flags_evaluation',
            attributes: expect.objectContaining({
              flags,
            }),
          },
        }),
      );
    });

    it('should use default version when not provided', async () => {
      const flags = ['show-maven-build-scope'];

      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: { data: { attributes: { evaluations: [] } } },
      });

      await evaluateFeatureFlagsForOrg(flags, orgId);

      const [payload] = makeRequestMock.mock.calls[0];
      expect(payload.url as string).toContain('version=2024-10-15');
    });

    it('should throw if orgId is missing', async () => {
      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], '' as any),
      ).rejects.toThrow('orgId is required');

      expect(makeRequestMock).not.toHaveBeenCalled();
    });

    it('should surface network errors from makeRequest', async () => {
      makeRequestMock.mockRejectedValue(new Error('Network error'));

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toThrow('Network error');
    });

    it('should map 401 to AuthFailedError', async () => {
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 401, statusMessage: 'Unauthorized' },
        body: {},
      });

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toThrow(AuthFailedError().message);
    });

    it('should map 429 to TestLimitReachedError', async () => {
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 429, statusMessage: 'Too Many Requests' },
        body: {},
      });

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toBeInstanceOf(TestLimitReachedError);
    });

    it('should map other non-200 status codes to ValidationError with body.error when present', async () => {
      makeRequestMock.mockResolvedValue({
        res: {
          statusCode: 400,
          statusMessage: 'Bad Request',
          body: { error: 'Something went wrong' },
        },
        body: { error: 'Something went wrong' },
      });

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toBeInstanceOf(ValidationError);

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toThrow('Something went wrong');
    });
  });

  describe('getEnabledFeatureFlags', () => {
    it('should return empty set if orgId is empty', async () => {
      const result = await getEnabledFeatureFlags(['test-ff'], '');
      expect(result).toEqual(new Set());

      expect(makeRequestMock).not.toHaveBeenCalled();
    });

    it('should return empty set if evaluation call throws', async () => {
      makeRequestMock.mockRejectedValue(new Error('Boom'));

      const result = await getEnabledFeatureFlags(['test-ff'], orgId);
      expect(result).toEqual(new Set());
    });

    it('should return empty set if evaluations is missing', async () => {
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: {
          data: {
            attributes: {},
          },
        },
      });

      const result = await getEnabledFeatureFlags(['test-ff'], orgId);
      expect(result).toEqual(new Set());
    });

    it('should return empty set if evaluations is empty', async () => {
      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: {
          data: {
            attributes: {
              evaluations: [],
            },
          },
        },
      });

      const result = await getEnabledFeatureFlags(['test-ff'], orgId);
      expect(result).toEqual(new Set());
    });

    it('should call gateway with [flag] in context', async () => {
      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');

      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: {
          data: {
            attributes: {
              evaluations: [{ key: 'test-ff', value: true, reason: 'found' }],
            },
          },
        },
      });

      const result = await getEnabledFeatureFlags(['test-ff'], orgId);
      expect(result.has('test-ff')).toBe(true);

      expect(makeRequestMock).toHaveBeenCalledTimes(1);
      const [payload] = makeRequestMock.mock.calls[0];

      expect(payload.body.data.attributes.flags).toEqual(['test-ff']);

      expect(payload.url).toEqual(
        `${config.API_HIDDEN_URL}/orgs/${encodeURIComponent(
          orgId,
        )}/feature_flags/evaluation?version=2024-10-15`,
      );
    });

    it.each`
      value        | expectedPresent
      ${true}      | ${true}
      ${false}     | ${false}
      ${undefined} | ${false}
    `(
      'should include flag in set = $expectedPresent when evaluation value=$value',
      async ({ value, expectedPresent }) => {
        const evaluations =
          value === undefined
            ? [{ key: 'other-flag', value: true, reason: 'found' }]
            : [{ key: 'test-ff', value, reason: 'found' }];

        makeRequestMock.mockResolvedValue({
          res: { statusCode: 200, statusMessage: 'OK' },
          body: {
            data: {
              attributes: {
                evaluations,
              },
            },
          },
        });

        const result = await getEnabledFeatureFlags(['test-ff'], orgId);
        expect(result.has('test-ff')).toBe(expectedPresent);

        if (value === undefined) {
          expect(result.has('other-flag')).toBe(true);
        }
      },
    );

    it('should support a list of flags and only include those evaluated as true', async () => {
      const flags = ['flag-a', 'flag-b', 'flag-c', 'flag-d'];

      makeRequestMock.mockResolvedValue({
        res: { statusCode: 200, statusMessage: 'OK' },
        body: {
          data: {
            attributes: {
              evaluations: [
                { key: 'flag-a', value: true, reason: 'found' },
                { key: 'flag-b', value: false, reason: 'found' },
                { key: 'flag-c', value: true, reason: 'found' },
              ],
            },
          },
        },
      });

      const result = await getEnabledFeatureFlags(flags, orgId);

      expect(result).toEqual(new Set(['flag-a', 'flag-c']));
      expect(result.has('flag-b')).toBe(false);
      expect(result.has('flag-d')).toBe(false);
    });
  });
});
