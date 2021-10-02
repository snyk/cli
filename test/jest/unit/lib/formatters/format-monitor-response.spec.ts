import stripAnsi = require('strip-ansi');

import {
  formatErrorMonitorOutput,
  formatMonitorOutput,
} from '../../../../../src/lib/formatters';

describe('formatErrorMonitorOutput', () => {
  it('maven monitor error', () => {
    const res = formatErrorMonitorOutput(
      'maven',
      {
        org: 'test-org',
        id: '123',
        path: 'src/lib/jens',
        licensesPolicy: {},
        uri: 'https://example.com/project',
        isMonitored: true,
        trialStarted: false,
      },
      {},
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('maven monitor error with --json', () => {
    const res = formatErrorMonitorOutput(
      'maven',
      {
        org: 'test-org',
        id: '123',
        path: 'src/lib/jens',
        licensesPolicy: {},
        uri: 'https://example.com/project',
        isMonitored: true,
        trialStarted: false,
      },
      { json: true },
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('npm with project name', () => {
    const res = formatErrorMonitorOutput(
      'npm',
      {
        org: 'test-org',
        id: '123',
        path: 'src/lib/jens',
        licensesPolicy: {},
        uri: 'https://example.com/project',
        isMonitored: true,
        trialStarted: false,
      },
      {},
      'custom-name',
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });
});

describe('formatMonitorOutput', () => {
  it('gradle scan with --all-sub-projects', () => {
    const monitorResult = {
      org: 'test-org',
      id: '123',
      path: 'src/lib/jens',
      licensesPolicy: {},
      uri: 'https://example.com/project',
      isMonitored: true,
      trialStarted: false,
    };
    const res = formatMonitorOutput(
      'gradle',
      monitorResult,
      { allSubProjects: true },
      undefined,
      7,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });
  it('gradle scan without --all-sub-projects', () => {
    const monitorResult = {
      org: 'test-org',
      id: '123',
      path: 'src/lib/jens',
      licensesPolicy: {},
      uri: 'https://example.com/project',
      isMonitored: true,
      trialStarted: false,
    };
    const res = formatMonitorOutput('gradle', monitorResult, {}, undefined, 7);
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('docker', () => {
    const monitorResult = {
      org: 'test-org',
      id: '123',
      path: 'src/lib/jens',
      licensesPolicy: {},
      uri: 'https://example.com/project',
      isMonitored: true,
      trialStarted: false,
    };
    const res = formatMonitorOutput(
      'deb',
      monitorResult,
      { docker: true },
      undefined,
      7,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('npm without --all-projects (more projects were detected)', () => {
    const monitorResult = {
      org: 'test-org',
      id: '123',
      path: 'src/lib/jens',
      licensesPolicy: {},
      uri: 'https://example.com/project',
      isMonitored: true,
      trialStarted: false,
    };
    const res = formatMonitorOutput('npm', monitorResult, {}, undefined, 7);
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it('npm with --all-projects (more projects were detected)', () => {
    const monitorResult = {
      org: 'test-org',
      id: '123',
      path: 'src/lib/jens',
      licensesPolicy: {},
      uri: 'https://example.com/project',
      isMonitored: true,
      trialStarted: false,
    };
    const res = formatMonitorOutput(
      'npm',
      monitorResult,
      { allProjects: true },
      undefined,
      7,
    );
    expect(stripAnsi(res)).toMatchSnapshot();
  });

  it.todo('--json');
});
