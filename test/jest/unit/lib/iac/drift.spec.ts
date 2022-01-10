const mockFs = require('mock-fs');

import { parseArgs } from '../../../../../src/lib/iac/drift';
import envPaths from 'env-paths';

const paths = envPaths('snyk');

describe('driftctl integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockFs.restore();
  });

  it('default arguments are correct', () => {
    const args = parseArgs(['scan'], {});
    expect(args).toEqual([
      'scan',
      '--config-dir',
      paths.cache,
      '--to',
      'aws+tf',
    ]);
  });

  it('passing options generate correct arguments', () => {
    const args = parseArgs(['scan'], {
      'config-dir': 'confdir',
      'tf-lockfile': 'tflockfile',
      'tf-provider-version': 'tfproviderversion',
      'tfc-endpoint': 'tfcendpoint',
      'tfc-token': 'tfctoken',
      deep: true,
      driftignore: 'driftignore',
      filter: 'filter',
      from: 'from',
      headers: 'headers',
      output: 'output',
      quiet: true,
      strict: true,
      to: 'to',
    });
    expect(args).toEqual([
      'scan',
      '--quiet',
      '--filter',
      'filter',
      '--output',
      'output',
      '--headers',
      'headers',
      '--tfc-token',
      'tfctoken',
      '--tfc-endpoint',
      'tfcendpoint',
      '--tf-provider-version',
      'tfproviderversion',
      '--strict',
      '--deep',
      '--driftignore',
      'driftignore',
      '--tf-lockfile',
      'tflockfile',
      '--config-dir',
      'confdir',
      '--from',
      'from',
      '--to',
      'to',
    ]);
  });
});
