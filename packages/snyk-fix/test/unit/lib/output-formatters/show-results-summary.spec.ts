import stripAnsi = require('strip-ansi');
import {
  CustomError,
  ERROR_CODES,
} from '../../../../src/lib/errors/custom-error';
import {
  generateFixedAndFailedSummary,
  generateSuccessfulFixesSummary,
  generateUnresolvedSummary,
  showResultsSummary,
} from '../../../../src/lib/output-formatters/show-results-summary';
import { FixHandlerResultByPlugin } from '../../../../src/plugins/types';
import { ErrorsByEcoSystem } from '../../../../src/types';
import { generateEntityToFix } from '../../../helpers/generate-entity-to-fix';

describe('generateFixedAndFailedSummary', () => {
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
    const res = await generateFixedAndFailedSummary(resultsByPlugin, {});
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
              },
            ],
          },
        ],
        failed: [],
        skipped: [],
      },
    };
    const res = await generateFixedAndFailedSummary(resultsByPlugin, {});
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
    const res = await generateFixedAndFailedSummary(resultsByPlugin, {});
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
    const res = await generateFixedAndFailedSummary(resultsByPlugin, {});
    expect(stripAnsi(res.summary)).toMatchSnapshot();
    expect(res.count).toEqual(3);
  });
});

describe('generateSuccessfulFixesSummary', () => {
  it('has fixed & failed', async () => {
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
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
              },
            ],
          },
        ],
        failed: [],
        skipped: [],
      },
    };
    const res = await generateSuccessfulFixesSummary(resultsByPlugin);
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
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
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
    const entityFailed = generateEntityToFix(
      'pip',
      '',
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
              },
              {
                success: false,
                reason: 'Version not compatible',
                userMessage: 'Failed to upgrade transitive from 6.1.0 to 6.2.1',
                tip: 'Apply the changes manually',
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

    const res = await showResultsSummary(resultsByPlugin, exceptionsByScanType);
    expect(stripAnsi(res)).toMatchSnapshot();
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

    const res = await showResultsSummary(resultsByPlugin, exceptionsByScanType);
    expect(stripAnsi(res)).toMatchSnapshot();
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

    const res = await showResultsSummary(resultsByPlugin, exceptionsByScanType);
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});
