import * as jsonModule from '../src/lib/json';

import { extractDataToSendFromResults } from '../src/cli/commands/test/formatters/format-test-results';
import { Options } from '../src/lib/types';
import * as fs from 'fs';

describe('format-test-results', () => {
  describe('extractDataToSendFromResults', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const resultsFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-npm/results.json', 'utf-8'),
    );
    const jsonDataFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-npm/jsonData.json', 'utf-8'),
    );

    it('should not create any JSON unless it is needed per options', () => {
      const options = {} as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(0);
      expect(res.stringifiedData).toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });

    it('should create Snyk JSON and only Snyk JSON if `--json` is set in the options', () => {
      const options = {
        json: true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });

    it('should create Snyk JSON and only Snyk JSON if `--json-file-output` is set in the options', () => {
      const options = {} as Options;
      options['json-file-output'] = 'somefile.json';
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });

    it('should create Snyk JSON and only Snyk JSON if `--json` and `--json-file-output` are set in the options', () => {
      const options = {
        json: true,
      } as Options;
      options['json-file-output'] = 'somefile.json';
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });

    it('should create SARIF JSON and only SARIF JSON if `--sarif` is set in the options', () => {
      const options = {
        sarif: true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
    });

    it('should create SARIF JSON and only SARIF JSON if `--sarif-file-output` is set in the options', () => {
      const options = {} as Options;
      options['sarif-file-output'] = 'somefile.json';
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
    });

    it('should create SARIF JSON and only SARIF JSON if `--sarif` and `--sarif-file-output` are set in the options', () => {
      const options = {
        sarif: true,
      } as Options;
      options['sarif-file-output'] = 'somefile.json';
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        jsonDataFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
    });
  });
});
