import { shareResults } from '../../../../src/lib/iac/cli-share-results';
import {
  expectedEnvelopeFormatterResults,
  generateScanResults,
} from './cli-share-results.fixtures';
import * as request from '../../../../src/lib/request';
import * as envelopeFormatters from '../../../../src/lib/iac/envelope-formatters';
import { IacShareResultsFormat } from '../../../../src/cli/commands/test/iac-local-execution/types';

describe('CLI Share Results', () => {
  let scanResults: IacShareResultsFormat[];
  let requestSpy, envelopeFormattersSpy;

  beforeAll(async () => {
    scanResults = generateScanResults();
    requestSpy = await jest.spyOn(request, 'makeRequest');
    envelopeFormattersSpy = await jest.spyOn(
      envelopeFormatters,
      'convertIacResultToScanResult',
    );
  });

  beforeEach(async () => {
    await shareResults(scanResults);
  });

  afterEach(() => {
    requestSpy.mockClear();
    envelopeFormattersSpy.mockClear();
  });

  it("converts the results to Envelops's ScanResult interface", () => {
    expect(envelopeFormattersSpy.mock.calls.length).toBe(2);

    const [firstCall, secondCall] = envelopeFormattersSpy.mock.calls;
    expect(firstCall[0]).toEqual(scanResults[0]);
    expect(secondCall[0]).toEqual(scanResults[1]);

    const [
      firstCallResult,
      secondCallResult,
    ] = envelopeFormattersSpy.mock.results;
    expect(firstCallResult.value).toEqual(expectedEnvelopeFormatterResults[0]);
    expect(secondCallResult.value).toEqual(expectedEnvelopeFormatterResults[1]);
  });

  it('forwards value to iac-cli-share-results endpoint', () => {
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
});
