import { shareResults } from '../../../../src/cli/commands/test/iac/local-execution/process-results/cli-share-results';
import {
  expectedEnvelopeFormatterResults,
  expectedEnvelopeFormatterResultsWithPolicy,
  createEnvelopeFormatterResultsWithTargetRef,
  scanResults,
} from './cli-share-results.fixtures';
import * as request from '../../../../src/lib/request/request';
import * as envelopeFormatters from '../../../../src/lib/iac/envelope-formatters';
import { Policy } from '../../../../src/lib/policy/find-and-load-policy';
import * as snykPolicyLib from 'snyk-policy';

describe('CLI Share Results', () => {
  let snykPolicy: Policy;
  let requestSpy: jest.SpiedFunction<typeof request.makeRequest>;
  let envelopeFormattersSpy: jest.SpiedFunction<
    typeof envelopeFormatters.convertIacResultToScanResult
  >;

  beforeAll(async () => {
    snykPolicy = await snykPolicyLib.load('test/jest/unit/iac/fixtures');
  });

  beforeEach(() => {
    requestSpy = jest
      .spyOn(request, 'makeRequest')
      .mockImplementation(async () => ({ res: {} as any, body: {} }));
    envelopeFormattersSpy = jest.spyOn(
      envelopeFormatters,
      'convertIacResultToScanResult',
    );
  });

  afterEach(() => {
    requestSpy.mockClear();
    envelopeFormattersSpy.mockClear();
  });

  it("converts the results to Envelope's ScanResult interface - without .snyk policies", async () => {
    await shareResults({
      results: scanResults,
      policy: undefined,
      meta: {
        projectName: 'project-name',
        orgName: 'org-name',
        gitRemoteUrl: 'http://github.com/snyk/cli.git',
      },
      options: {},
    });

    expect(envelopeFormattersSpy.mock.calls.length).toBe(2);

    const [firstCall, secondCall] = envelopeFormattersSpy.mock.calls;
    expect(firstCall[0]).toEqual(scanResults[0]);
    expect(secondCall[0]).toEqual(scanResults[1]);

    const [firstCallResult, secondCallResult] =
      envelopeFormattersSpy.mock.results;

    expect(firstCallResult.value).toEqual(expectedEnvelopeFormatterResults[0]);
    expect(secondCallResult.value).toEqual(expectedEnvelopeFormatterResults[1]);
  });

  it("converts the results to Envelope's ScanResult interface - with .snyk policies", async () => {
    await shareResults({
      results: scanResults,
      policy: snykPolicy,
      meta: {
        projectName: 'project-name',
        orgName: 'org-name',
        gitRemoteUrl: 'http://github.com/snyk/cli.git',
      },
      options: {},
    });

    expect(envelopeFormattersSpy.mock.calls.length).toBe(2);

    const [firstCall, secondCall] = envelopeFormattersSpy.mock.calls;
    expect(firstCall[0]).toEqual(scanResults[0]);
    expect(secondCall[0]).toEqual(scanResults[1]);

    const [firstCallResult, secondCallResult] =
      envelopeFormattersSpy.mock.results;

    expect(firstCallResult.value).toEqual(
      expectedEnvelopeFormatterResultsWithPolicy[0],
    );
    expect(secondCallResult.value).toEqual(
      expectedEnvelopeFormatterResultsWithPolicy[1],
    );
  });

  describe('when given a target reference', () => {
    it("should include it in the Envelope's ScanResult interface", async () => {
      const testTargetRef = 'test-target-ref';
      const expectedEnvelopeFormatterResults =
        createEnvelopeFormatterResultsWithTargetRef(testTargetRef);

      await shareResults({
        results: scanResults,
        policy: undefined,
        options: {
          'target-reference': testTargetRef,
        },
        meta: {
          projectName: 'project-name',
          orgName: 'org-name',
          gitRemoteUrl: 'http://github.com/snyk/cli.git',
        },
      });

      expect(envelopeFormattersSpy.mock.calls.length).toBe(2);

      const [firstCall, secondCall] = envelopeFormattersSpy.mock.calls;
      expect(firstCall[0]).toEqual(scanResults[0]);
      expect(secondCall[0]).toEqual(scanResults[1]);

      const [firstCallResult, secondCallResult] =
        envelopeFormattersSpy.mock.results;
      expect(firstCallResult.value).toEqual(
        expectedEnvelopeFormatterResults[0],
      );

      expect(secondCallResult.value).toEqual(
        expectedEnvelopeFormatterResults[1],
      );
    });
  });

  it('forwards value to iac-cli-share-results endpoint', async () => {
    await shareResults({
      results: scanResults,
      policy: undefined,
      meta: {
        projectName: 'project-name',
        orgName: 'org-name',
        gitRemoteUrl: 'http://github.com/snyk/cli.git',
      },
      options: {},
    });

    expect(requestSpy.mock.calls.length).toBe(1);

    expect(requestSpy.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining('/iac-cli-share-results'),
      json: true,
      headers: expect.objectContaining({
        authorization: expect.stringContaining('token'),
      }),
    });
  });

  it('respects the org flag provided', async () => {
    await shareResults({
      results: scanResults,
      policy: undefined,
      options: {
        org: 'my-custom-org',
      },
      meta: {
        projectName: 'project-name',
        orgName: 'org-name',
        gitRemoteUrl: 'http://github.com/snyk/cli.git',
      },
    });

    expect(requestSpy.mock.calls.length).toBe(1);

    expect(requestSpy.mock.calls[0][0]).toMatchObject({
      method: 'POST',
      url: expect.stringContaining('/iac-cli-share-results'),
      qs: expect.objectContaining({ org: 'my-custom-org' }),
      headers: expect.objectContaining({
        authorization: expect.stringContaining('token'),
      }),
    });
  });
});
