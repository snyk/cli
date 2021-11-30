import { Options } from '../../../../../../src/lib/types';
import fs from 'fs';
import { extractDataToSendFromResults } from '../../../../../../src/lib/formatters/test/format-test-results';

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
  const resultsContainerFixture = JSON.parse(
    fs.readFileSync('test/fixtures/basic-apk/results.json', 'utf-8'),
  );
  const jsonDataContainerFixture = JSON.parse(
    fs.readFileSync('test/fixtures/basic-apk/jsonData.json', 'utf-8'),
  );
  const jsonDataGroupedContainerFixture = JSON.parse(
    fs.readFileSync('test/fixtures/basic-apk/jsonDataGrouped.json', 'utf-8'),
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

  it('should create Snyk grouped JSON for container image if `--json` and `--group-issues` are set in the options', () => {
    const options = {
      json: true,
      'group-issues': true,
    } as Options;
    const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
    const res = extractDataToSendFromResults(
      resultsContainerFixture,
      jsonDataContainerFixture,
      options,
    );
    expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
      jsonDataGroupedContainerFixture,
    );
    expect(res.stringifiedData).not.toBe('');
    expect(res.stringifiedJsonData).not.toBe('');
    expect(res.stringifiedSarifData).toBe('');
  });
});
