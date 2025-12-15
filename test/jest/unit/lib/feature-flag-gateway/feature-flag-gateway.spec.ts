import {
  evaluateFeatureFlagsForOrg,
  getFeatureFlagValue,
} from '../../../../../src/lib/feature-flag-gateway';
import * as request from '../../../../../src/lib/request';
import config from '../../../../../src/lib/config';
import * as apiToken from '../../../../../src/lib/api-token';

describe('feature-flag-gateway client', () => {
  const orgId = 'f1900900-3db1-4bed-b873-78f589d5a59c';
  const version = '2024-10-15';

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateFeatureFlagsForOrg', () => {
    it('should POST to /hidden/orgs/:orgId/feature_flags/evaluation with version querystring and return parsed body', async () => {
      const flags = ['show-maven-build-scope', 'snykCode'];

      const mockResp = {
        body: {
          data: {
            attributes: {
              evaluations: [
                { key: 'show-maven-build-scope', value: true, reason: 'found' },
                { key: 'snykCode', value: false, reason: 'found' },
              ],
              evaluatedAt: '2025-01-01T00:00:00Z',
            },
          },
        },
      };

      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');
      jest.spyOn(request, 'makeRequest').mockResolvedValue(mockResp as any);

      const result = await evaluateFeatureFlagsForOrg(flags, orgId, version);

      expect(result).toEqual(mockResp.body);

      expect(request.makeRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `${config.API}/hidden/orgs/${encodeURIComponent(
            orgId,
          )}/feature_flags/evaluation`,
          qs: expect.objectContaining({ version }),
          headers: expect.objectContaining({
            'Content-Type': 'application/vnd.api+json',
            Authorization: 'token test-token',
          }),
          json: true,
          gzip: true,
        }),
      );

      const call = (request.makeRequest as jest.Mock).mock.calls[0][0];
      expect(call.body).toEqual(
        expect.objectContaining({
          data: {
            type: 'feature_flags_evaluation',
            attributes: {
              flags,
              context: { orgId },
            },
          },
        }),
      );
    });

    it('should use default version when not provided', async () => {
      const flags = ['show-maven-build-scope'];

      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');
      jest.spyOn(request, 'makeRequest').mockResolvedValue({
        body: { data: { attributes: { evaluations: [] } } },
      } as any);

      await evaluateFeatureFlagsForOrg(flags, orgId);

      const call = (request.makeRequest as jest.Mock).mock.calls[0][0];
      expect(call.qs).toEqual(
        expect.objectContaining({ version: '2024-10-15' }),
      );
    });

    it('should throw if orgId is missing', async () => {
      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], '' as any),
      ).rejects.toThrow('orgId is required');
    });

    it('should surface errors from makeRequest', async () => {
      jest
        .spyOn(request, 'makeRequest')
        .mockRejectedValue(new Error('Network error'));

      await expect(
        evaluateFeatureFlagsForOrg(['show-maven-build-scope'], orgId),
      ).rejects.toThrow('Network error');
    });
  });

  describe('getFeatureFlagValue', () => {
    it('should return false if orgId is missing (and not call makeRequest)', async () => {
      const spy = jest.spyOn(request, 'makeRequest');

      await expect(getFeatureFlagValue('test-ff', undefined)).resolves.toBe(
        false,
      );
      await expect(getFeatureFlagValue('test-ff', '')).resolves.toBe(false);

      expect(spy).not.toHaveBeenCalled();
    });

    it('should return false if evaluation call throws', async () => {
      jest.spyOn(request, 'makeRequest').mockRejectedValue(new Error('Boom'));

      const result = await getFeatureFlagValue('test-ff', orgId);
      expect(result).toBe(false);
    });

    it('should return false if evaluations is missing', async () => {
      jest.spyOn(request, 'makeRequest').mockResolvedValue({
        body: {
          data: {
            attributes: {
              // no evaluations
            },
          },
        },
      } as any);

      const result = await getFeatureFlagValue('test-ff', orgId);
      expect(result).toBe(false);
    });

    it('should return false if evaluations is empty', async () => {
      jest.spyOn(request, 'makeRequest').mockResolvedValue({
        body: {
          data: {
            attributes: {
              evaluations: [],
            },
          },
        },
      } as any);

      const result = await getFeatureFlagValue('test-ff', orgId);
      expect(result).toBe(false);
    });

    it('should call gateway with [flag] and orgId in context', async () => {
      jest.spyOn(apiToken, 'getAuthHeader').mockReturnValue('token test-token');
      jest.spyOn(request, 'makeRequest').mockResolvedValue({
        body: {
          data: {
            attributes: {
              evaluations: [{ key: 'test-ff', value: true, reason: 'found' }],
            },
          },
        },
      } as any);

      const result = await getFeatureFlagValue('test-ff', orgId);
      expect(result).toBe(true);

      const call = (request.makeRequest as jest.Mock).mock.calls[0][0];
      expect(call.body.data.attributes.flags).toEqual(['test-ff']);
      expect(call.body.data.attributes.context).toEqual({ orgId });
      expect(call.url).toEqual(
        `${config.API}/hidden/orgs/${encodeURIComponent(
          orgId,
        )}/feature_flags/evaluation`,
      );
    });

    it.each`
      value        | expected
      ${true}      | ${true}
      ${false}     | ${false}
      ${undefined} | ${false}
    `(
      'should return $expected for flag evaluation value=$value',
      async ({ value, expected }) => {
        jest.spyOn(request, 'makeRequest').mockResolvedValue({
          body: {
            data: {
              attributes: {
                evaluations:
                  value === undefined
                    ? [{ key: 'other-flag', value: true, reason: 'found' }]
                    : [{ key: 'test-ff', value, reason: 'found' }],
              },
            },
          },
        } as any);

        const result = await getFeatureFlagValue('test-ff', orgId);
        expect(result).toEqual(expected);
      },
    );
  });
});
