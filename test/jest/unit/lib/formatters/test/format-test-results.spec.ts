import { Options } from '../../../../../../src/lib/types';
import * as fs from 'fs';
import { extractDataToSendFromResults } from '../../../../../../src/lib/formatters/test/format-test-results';
//import exp from 'constants';

describe('extractDataToSendFromResults', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.SET_AUTOMATION_DETAILS_ID = "";
  });

  describe('open source results', () => {
    const resultsFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-npm/results.json', 'utf-8'),
    );

    const mappedResultsFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-npm/mappedResults.json', 'utf-8'),
    );

    it('docker - should not fail due to missing vulns', () => {
      const noVulnerabilityFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/basic-npm/noVulnerabilities.json',
          'utf-8',
        ),
      );

      const options = {
        json: true,
        docker: true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        noVulnerabilityFixture,
        noVulnerabilityFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });

    it('should not create any JSON unless it is needed per options', () => {
      const options = {} as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        mappedResultsFixture,
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
        mappedResultsFixture,
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
        mappedResultsFixture,
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
        mappedResultsFixture,
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
        mappedResultsFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
      var sarif = JSON.parse(res.stringifiedSarifData);
      expect(sarif.runs[0].automationDetails.id).toBe('');
    });

    it('should create SARIF JSON and only SARIF JSON if `--sarif` is set in the options and SET_AUTOMATION_DETAILS_ID is set', () => {
      const options = {
        sarif: true,
      } as Options;
      process.env.SET_AUTOMATION_DETAILS_ID = "true";

      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        mappedResultsFixture,
        options,
      );

      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
      var sarif = JSON.parse(res.stringifiedSarifData);
      expect(sarif.runs[0].automationDetails.id).not.toBe('');
    });

    it('should create SARIF JSON and only SARIF JSON if `--sarif-file-output` is set in the options', () => {
      const options = {} as Options;
      options['sarif-file-output'] = 'somefile.json';
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsFixture,
        mappedResultsFixture,
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
        mappedResultsFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).toBe('');
      expect(res.stringifiedSarifData).not.toBe('');
    });
  });

  describe('open source results grouping', () => {
    describe('single project results grouping', () => {
      const resultsFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectResults.json',
          'utf-8',
        ),
      );

      const mappedResultsFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectMappedResults.json',
          'utf-8',
        ),
      );

      const resultJsonDataGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectResultJsonDataGrouped.json',
          'utf-8',
        ),
      );

      const resultJsonDataNonGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectResultJsonDataNonGrouped.json',
          'utf-8',
        ),
      );

      it('should create grouped Snyk JSON and only grouped Snyk JSON if `--json` and `--group-issues` is set in the options', () => {
        const options = {
          json: true,
          'group-issues': true,
        } as Options;
        const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
        const res = extractDataToSendFromResults(
          resultsFixture,
          mappedResultsFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          resultJsonDataGroupedFixture,
        );
        expect(res.stringifiedData).not.toBe('');
        expect(res.stringifiedJsonData).not.toBe('');
        expect(res.stringifiedSarifData).toBe('');
        expect(
          JSON.parse(res.stringifiedJsonData).vulnerabilities,
        ).toHaveLength(7);
      });

      it('should create non-grouped Snyk JSON and only Snyk JSON if `--json` is set in the options', () => {
        const options = {
          json: true,
        } as Options;
        const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
        const res = extractDataToSendFromResults(
          resultsFixture,
          mappedResultsFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          resultJsonDataNonGroupedFixture,
        );
        expect(res.stringifiedData).not.toBe('');
        expect(res.stringifiedJsonData).not.toBe('');
        expect(res.stringifiedSarifData).toBe('');
        expect(
          JSON.parse(res.stringifiedJsonData).vulnerabilities,
        ).toHaveLength(11);
      });
    });

    describe('multiple project results grouping', () => {
      const resultsFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectResults.json',
          'utf-8',
        ),
      );

      const mappedResultsFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectMappedResults.json',
          'utf-8',
        ),
      );

      const resultJsonDataGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectResultJsonDataGrouped.json',
          'utf-8',
        ),
      );

      const resultJsonDataNonGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectResultJsonDataNonGrouped.json',
          'utf-8',
        ),
      );

      it('should create grouped Snyk JSON for each of the projects in the result if `--json` and `--group-issues` is set in the options', () => {
        const options = {
          json: true,
          'group-issues': true,
        } as Options;
        const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
        const res = extractDataToSendFromResults(
          resultsFixture,
          mappedResultsFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          resultJsonDataGroupedFixture,
        );
        expect(res.stringifiedData).not.toBe('');
        expect(res.stringifiedJsonData).not.toBe('');
        expect(res.stringifiedSarifData).toBe('');
        expect(
          JSON.parse(res.stringifiedJsonData)[0].vulnerabilities,
        ).toHaveLength(7);
        expect(
          JSON.parse(res.stringifiedJsonData)[1].vulnerabilities,
        ).toHaveLength(2);
      });

      it('should create non-grouped Snyk JSON for each of the projects in the result if `--json` is set in the options', () => {
        const options = {
          json: true,
        } as Options;
        const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
        const res = extractDataToSendFromResults(
          resultsFixture,
          mappedResultsFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          resultJsonDataNonGroupedFixture,
        );
        expect(res.stringifiedData).not.toBe('');
        expect(res.stringifiedJsonData).not.toBe('');
        expect(res.stringifiedSarifData).toBe('');
        expect(
          JSON.parse(res.stringifiedJsonData)[0].vulnerabilities,
        ).toHaveLength(11);
        expect(
          JSON.parse(res.stringifiedJsonData)[1].vulnerabilities,
        ).toHaveLength(4);
      });
    });
  });

  describe('container image json results', () => {
    const resultsContainerFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-apk/results.json', 'utf-8'),
    );

    const mappedResultsContainerFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-apk/mappedResults.json', 'utf-8'),
    );
    const resultJsonDataGroupedContainerFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/basic-apk/resultJsonDataGrouped.json',
        'utf-8',
      ),
    );

    it('should create Snyk grouped JSON for container image if `--json` and `--group-issues` are set in the options', () => {
      const options = {
        json: true,
        docker: true,
        'group-issues': true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsContainerFixture,
        mappedResultsContainerFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
        resultJsonDataGroupedContainerFixture,
      );
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
    });
  });

  describe('container app and os json results', () => {
    const resultsContainerAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/results.json',
        'utf-8',
      ),
    );
    const mappedResultsAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/mappedResults.json',
        'utf-8',
      ),
    );
    const resultJsonDataGroupedContainerAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/resultJsonDataGrouped.json',
        'utf-8',
      ),
    );
    const resultJsonDataNonGroupedContainerAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/resultJsonDataNonGrouped.json',
        'utf-8',
      ),
    );

    it('should create Snyk grouped JSON for each of the multiple test results if `--json` and `--group-issues` are set in the options', () => {
      const options = {
        json: true,
        docker: true,
        'group-issues': true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsContainerAppVulnsFixture,
        mappedResultsAppVulnsFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      const parsedStringifiedJson = JSON.parse(res.stringifiedJsonData);
      expect(parsedStringifiedJson).toMatchObject(
        resultJsonDataGroupedContainerAppVulnsFixture,
      );
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
      expect(parsedStringifiedJson.vulnerabilities).toHaveLength(1);
      expect(parsedStringifiedJson.applications).not.toBeUndefined();
      expect(
        parsedStringifiedJson.applications[0].vulnerabilities,
      ).toHaveLength(7);
    });

    it('should create a non-grouped JSON for each of the test results if `--json` option is set and `--group-issues` is not set', () => {
      const options = {
        json: true,
        docker: true,
      } as Options;
      const jsonStringifySpy = jest.spyOn(JSON, 'stringify');
      const res = extractDataToSendFromResults(
        resultsContainerAppVulnsFixture,
        mappedResultsAppVulnsFixture,
        options,
      );
      expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
      const parsedStringifiedJson = JSON.parse(res.stringifiedJsonData);
      expect(parsedStringifiedJson).toMatchObject(
        resultJsonDataNonGroupedContainerAppVulnsFixture,
      );
      expect(res.stringifiedData).not.toBe('');
      expect(res.stringifiedJsonData).not.toBe('');
      expect(res.stringifiedSarifData).toBe('');
      expect(parsedStringifiedJson.vulnerabilities).toHaveLength(3);
      expect(parsedStringifiedJson.applications).not.toBeUndefined();
      expect(
        parsedStringifiedJson.applications[0].vulnerabilities,
      ).toHaveLength(11);
    });
  });
});
