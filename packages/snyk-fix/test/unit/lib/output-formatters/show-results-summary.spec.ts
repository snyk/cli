import stripAnsi = require('strip-ansi');
import {
  CustomError,
  ERROR_CODES,
} from '../../../../src/lib/errors/custom-error';
import {
  generateOverallSummary,
  generateSuccessfulFixesSummary,
  generateUnresolvedSummary,
  formatIssueCountBySeverity,
  showResultsSummary,
} from '../../../../src/lib/output-formatters/show-results-summary';
import { FixHandlerResultByPlugin } from '../../../../src/plugins/types';
import { ErrorsByEcoSystem } from '../../../../src/types';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('generateOverallSummary', () => {
  it('has fixed & failed', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const entityFailed = generateEntityToFix(
      'pip',
      'bad.txt',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-2'],
              },
            ],
          },
        ],
        failed: [
          {
            original: entityFailed,
            error: new CustomError('Failed!', ERROR_CODES.MissingFileName),
          },
        ],
        skipped: [],
      },
    };
    const res = await generateOverallSummary(resultsByPlugin, {}, [], {});
    expect(stripAnsi(res.summary)).toMatchSnapshot();
  });

  it('has fixed only', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-1'],
              },
            ],
          },
        ],
        failed: [],
        skipped: [],
      },
    };
    const res = await generateOverallSummary(resultsByPlugin, {}, [], {});
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(1);
  });

  it('has failed only', async () => {
    const entityFailed = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [
          {
            original: entityFailed,
            error: new CustomError('Failed!', ERROR_CODES.MissingFileName),
          },
        ],
        skipped: [],
      },
    };
    const res = await generateOverallSummary(resultsByPlugin, {}, [], {
      dryRun: true,
    });
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(1);
  });

  it('has skipped & failed & plugin errors', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const entityFailed = generateEntityToFix(
      'pip',
      'bad.txt',
      JSON.stringify({}),
    );
    const entitySkipped = generateEntityToFix(
      'pip',
      'Pipfile',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-1'],
              },
            ],
          },
        ],
        failed: [
          {
            original: entityFailed,
            error: new CustomError('Failed!', ERROR_CODES.MissingFileName),
          },
        ],
        skipped: [
          { original: entitySkipped, userMessage: 'Pipfile is not supported' },
        ],
      },
    };
    const res = await generateOverallSummary(resultsByPlugin, {}, [], {
      dryRun: true,
    });
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(3);
  });
  it('has fixed & failed & not vulnerable', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const entityFailed = generateEntityToFix(
      'pip',
      'bad.txt',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-2'],
              },
            ],
          },
        ],
        failed: [
          {
            original: entityFailed,
            error: new CustomError('Failed!', ERROR_CODES.MissingFileName),
          },
        ],
        skipped: [],
      },
    };
    const notVulnerable = generateEntityToFix(
      'pip',
      '',
      JSON.stringify({}),
      false,
    );
    const res = await generateOverallSummary(
      resultsByPlugin,
      {},
      [notVulnerable],
      {
        dryRun: true,
      },
    );
    expect(stripAnsi(res.summary)).toMatchSnapshot();
  });

  it('100% not vulnerable', async () => {
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [],
        skipped: [],
      },
    };
    const notVulnerable = generateEntityToFix(
      'pip',
      '',
      JSON.stringify({}),
      false,
    );
    const res = await generateOverallSummary(
      resultsByPlugin,
      {},
      [notVulnerable],
      {
        dryRun: true,
      },
    );
    expect(stripAnsi(res.summary)).toMatchSnapshot();
  });
});

describe('generateSuccessfulFixesSummary', () => {
  it('has fixed & failed', () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-2'],
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
                issueIds: ['vuln-1'],
              },
            ],
          },
        ],
        failed: [],
        skipped: [],
      },
    };
    const res = generateSuccessfulFixesSummary(resultsByPlugin);
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});

describe('generateUnresolvedSummary', () => {
  it('has failed upgrades & unsupported', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const entityFailed = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-2'],
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
                issueIds: ['vuln-1'],
              },
            ],
          },
        ],
        failed: [],
        skipped: [],
      },
    };
    const exceptionsByScanType: ErrorsByEcoSystem = {
      python: {
        originals: [entityFailed],
        userMessage: 'npm is not supported',
      },
    };

    const res = await generateUnresolvedSummary(
      resultsByPlugin,
      exceptionsByScanType,
    );
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(1);
  });

  it('has f100% ailed upgrades', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [
          {
            original: entity,
            changes: [
              {
                success: false,
                userMessage: 'Failed to upgrade Django from 1.6.1 to 2.0.1',
                reason: 'Version not compatible',
                tip: 'Apply the changes manually',
                issueIds: ['vuln-2'],
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
                issueIds: ['vuln-1'],
              },
            ],
          },
        ],
        skipped: [],
      },
    };

    const res = await generateUnresolvedSummary(resultsByPlugin, {});
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(1);
  });
});

describe('formatIssueCountBySeverity', () => {
  it('all vuln severities present', async () => {
    const res = await formatIssueCountBySeverity({
      critical: 1,
      high: 3,
      medium: 15,
      low: 300,
    });
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('all vuln severities absent', async () => {
    const res = await formatIssueCountBySeverity({});
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('all vuln severities 0', async () => {
    const res = await formatIssueCountBySeverity({
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    });
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('Critical vulns 0', async () => {
    const res = await formatIssueCountBySeverity({
      critical: 0,
      high: 1,
      medium: 2,
      low: 60,
    });
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});

describe('showResultsSummary', () => {
  it('has failed, skipped, successful & plugin errors', async () => {
    const entity = generateEntityToFix(
      'pip',
      'requirements.txt',
      JSON.stringify({}),
    );
    const entityNotSupported = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    const entityFailed = generateEntityToFix('pip', '', JSON.stringify({}));
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [
          {
            original: entity,
            changes: [
              {
                success: true,
                userMessage: 'Upgraded Django from 1.6.1 to 2.0.1',
                issueIds: ['vuln-1'],
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
                issueIds: ['vuln-2'],
              },
            ],
          },
        ],
        failed: [
          {
            original: entityFailed,
            error: new CustomError(
              'Missing required file name',
              ERROR_CODES.MissingFileName,
            ),
          },
        ],
        skipped: [],
      },
    };
    const exceptionsByScanType: ErrorsByEcoSystem = {
      python: {
        originals: [entityNotSupported],
        userMessage: 'npm is not supported',
      },
    };

    const res = await showResultsSummary(
      [],
      resultsByPlugin,
      exceptionsByScanType,
      { stripAnsi: true },
      3,
    );
    expect(res).toMatchSnapshot();
  });
  it('has unresolved only', async () => {
    const entityFailed = generateEntityToFix(
      'npm',
      'package.json',
      JSON.stringify({}),
    );
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [],
        skipped: [],
      },
    };
    const exceptionsByScanType: ErrorsByEcoSystem = {
      python: {
        originals: [entityFailed],
        userMessage: 'npm is not supported',
      },
    };

    const res = await showResultsSummary(
      [],
      resultsByPlugin,
      exceptionsByScanType,
      { stripAnsi: true },
      1,
    );
    expect(res).toMatchSnapshot();
  });
  it('called with nothing to fix', async () => {
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [],
        skipped: [],
      },
    };
    const exceptionsByScanType: ErrorsByEcoSystem = {};

    const res = await showResultsSummary(
      [],
      resultsByPlugin,
      exceptionsByScanType,
      { stripAnsi: true },
      0,
    );
    expect(res).toMatchSnapshot();
  });
  it('called with no vulnerable projects to fix', async () => {
    const resultsByPlugin: FixHandlerResultByPlugin = {
      python: {
        succeeded: [],
        failed: [],
        skipped: [],
      },
    };
    const exceptionsByScanType: ErrorsByEcoSystem = {};
    const notVulnerable = generateEntityToFix(
      'pip',
      '',
      JSON.stringify({}),
      false,
    );

    const res = await showResultsSummary(
      [notVulnerable],
      resultsByPlugin,
      exceptionsByScanType,
      {},
      1,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
