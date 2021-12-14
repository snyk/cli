import { Options } from '../../../../../../src/lib/types';
import * as fs from 'fs';
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
  const resultsContainerAppVulnsFixture = JSON.parse(
    fs.readFileSync('test/fixtures/container-app-vulns/results.json', 'utf-8'),
  );
  const jsonDataContainerAppVulnsFixture = JSON.parse(
    fs.readFileSync('test/fixtures/container-app-vulns/jsonData.json', 'utf-8'),
  );
  const jsonDataGroupedContainerAppVulnsFixture = JSON.parse(
    fs.readFileSync(
      'test/fixtures/container-app-vulns/jsonDataGrouped.json',
      'utf-8',
    ),
  );
  const jsonDataNonGroupedContainerAppVulnsFixture = JSON.parse(
    fs.readFileSync(
      'test/fixtures/container-app-vulns/jsonDataNonGrouped.json',
      'utf-8',
    ),
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

  it('should create Snyk grouped JSON for each of the multiple test results if `--json`, `--app-vulns` and `--group-issues` are set in the options', () => {
    const options = {
      json: true,
      'app-vulns': true,
      'group-issues': true,
    } as Options;
    const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
    const res = extractDataToSendFromResults(
      resultsContainerAppVulnsFixture,
      jsonDataContainerAppVulnsFixture,
      options,
    );
    expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
      jsonDataGroupedContainerAppVulnsFixture,
    );
    expect(res.stringifiedData).not.toBe('');
    expect(res.stringifiedJsonData).not.toBe('');
    expect(res.stringifiedSarifData).toBe('');
    expect(JSON.parse(res.stringifiedJsonData)[0].vulnerabilities).toHaveLength(
      1,
    );
    expect(JSON.parse(res.stringifiedJsonData)[1].vulnerabilities).toHaveLength(
      7,
    );
  });

  it('should create a non-grouped JSON for each of the test results if `--json` and `--app-vulns` options are set and `--group-issues` is not set', () => {
    const options = {
      json: true,
      'app-vulns': true,
    } as Options;
    const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
    const res = extractDataToSendFromResults(
      resultsContainerAppVulnsFixture,
      jsonDataContainerAppVulnsFixture,
      options,
    );
    expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
      jsonDataNonGroupedContainerAppVulnsFixture,
    );
    expect(res.stringifiedData).not.toBe('');
    expect(res.stringifiedJsonData).not.toBe('');
    expect(res.stringifiedSarifData).toBe('');
    expect(JSON.parse(res.stringifiedJsonData)[0].vulnerabilities).toHaveLength(
      3,
    );
    expect(JSON.parse(res.stringifiedJsonData)[1].vulnerabilities).toHaveLength(
      11,
    );
  });
});
