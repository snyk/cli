import { Options } from '../../../../../../src/lib/types';
import * as fs from 'fs';
import { extractDataToSendFromResults } from '../../../../../../src/lib/formatters/test/format-test-results';

describe('extractDataToSendFromResults', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('open source results', () => {
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

  describe('open source results grouping', () => {
    describe('single project results grouping', () => {
      const resultsFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectResults.json',
          'utf-8',
        ),
      );

      const jsonDataFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectJsonData.json',
          'utf-8',
        ),
      );

      const jsonDataGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectJsonDataGrouped.json',
          'utf-8',
        ),
      );

      const jsonDataNonGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/singleProjectJsonDataNonGrouped.json',
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
          jsonDataFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          jsonDataGroupedFixture,
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
          jsonDataFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          jsonDataNonGroupedFixture,
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

      const jsonDataFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectJsonData.json',
          'utf-8',
        ),
      );

      const jsonDataGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectJsonDataGrouped.json',
          'utf-8',
        ),
      );

      const jsonDataNonGroupedFixture = JSON.parse(
        fs.readFileSync(
          'test/fixtures/npm/issue-grouping/multiProjectJsonDataNonGrouped.json',
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
          jsonDataFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          jsonDataGroupedFixture,
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
          jsonDataFixture,
          options,
        );
        expect(jsonStringifySpy).toHaveBeenCalledTimes(1);
        expect(JSON.parse(res.stringifiedJsonData)).toMatchObject(
          jsonDataNonGroupedFixture,
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
    const jsonDataContainerFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-apk/jsonData.json', 'utf-8'),
    );
    const jsonDataGroupedContainerFixture = JSON.parse(
      fs.readFileSync('test/fixtures/basic-apk/jsonDataGrouped.json', 'utf-8'),
    );

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

  describe('container app and os json results', () => {
    const resultsContainerAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/results.json',
        'utf-8',
      ),
    );
    const jsonDataContainerAppVulnsFixture = JSON.parse(
      fs.readFileSync(
        'test/fixtures/container-app-vulns/jsonData.json',
        'utf-8',
      ),
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

    it('should create Snyk grouped JSON for each of the multiple test results if `--json` and `--group-issues` are set in the options', () => {
      const options = {
        json: true,
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
      expect(
        JSON.parse(res.stringifiedJsonData)[0].vulnerabilities,
      ).toHaveLength(1);
      expect(
        JSON.parse(res.stringifiedJsonData)[1].vulnerabilities,
      ).toHaveLength(7);
    });

    it('should create a non-grouped JSON for each of the test results if `--json` option is set and `--group-issues` is not set', () => {
      const options = {
        json: true,
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
      expect(
        JSON.parse(res.stringifiedJsonData)[0].vulnerabilities,
      ).toHaveLength(3);
      expect(
        JSON.parse(res.stringifiedJsonData)[1].vulnerabilities,
      ).toHaveLength(11);
    });
  });
});
