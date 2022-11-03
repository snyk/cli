import {
  assertIaCOptionsFlags,
  assertIntegratedIaCOnlyOptions,
  FlagValueError,
  IntegratedFlagError,
} from '../../../../src/cli/commands/test/iac/local-execution/assert-iac-options-flag';
import { IacOrgSettings } from '../../../../src/cli/commands/test/iac/local-execution/types';

describe('assertIntegratedIaCOnlyOptions()', () => {
  const command = ['node', 'cli', 'iac', 'test'];
  const files = ['input.tf'];
  const org: IacOrgSettings = {
    customPolicies: {},
    meta: {
      org: 'orgname',
      orgPublicId: 'orgpublicid',
    },
  };

  it('accepts all command line flags accepted by the iac command', () => {
    const options = [
      '--debug',
      '--insecure',
      '--detection-depth',
      '--severity-threshold',
      '--json',
      '--sarif',
      '--json-file-output',
      '--sarif-file-output',
      '-v',
      '--version',
      '-h',
      '--help',
      '-q',
      '--quiet',
    ];
    expect(() =>
      assertIntegratedIaCOnlyOptions(org, [...command, ...options, ...files]),
    ).not.toThrow();
  });

  it('Refuses cloud-context flag', () => {
    const options = ['--cloud-context', 'aws'];
    expect(() =>
      assertIntegratedIaCOnlyOptions(org, [...command, ...options, ...files]),
    ).toThrow(new IntegratedFlagError('cloud-context', org.meta.org));
  });

  it('Refuses snyk-cloud-environment flag', () => {
    const options = ['--snyk-cloud-environment', 'envid'];
    expect(() =>
      assertIntegratedIaCOnlyOptions(org, [...command, ...options, ...files]),
    ).toThrow(new IntegratedFlagError('snyk-cloud-environment', org.meta.org));
  });
});

describe('assertIaCOptionsFlags()', () => {
  const command = ['node', 'cli', 'iac', 'test'];
  const files = ['input.tf'];

  it('accepts all command line flags accepted by the iac command', () => {
    const options = [
      '--debug',
      '--insecure',
      '--detection-depth',
      '--severity-threshold',
      '--json',
      '--sarif',
      '--json-file-output',
      '--sarif-file-output',
      '-v',
      '--version',
      '-h',
      '--help',
      '-q',
      '--quiet',
    ];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).not.toThrow();
  });

  it('accepts an empty options object', () => {
    expect(() => assertIaCOptionsFlags([...command, ...files])).not.toThrow();
  });

  it('throws an error if an unexpected flag is present', () => {
    const options = ['--project-name'];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).toThrow();
  });

  it('throws an error if a flag contains a typo', () => {
    const options = ['--experimenta'];
    expect(() =>
      assertIaCOptionsFlags([...command, ...options, ...files]),
    ).toThrow();
  });

  describe('Terraform plan scan modes', () => {
    it('throws an error if the scan flag has no value', () => {
      const options = ['--scan'];
      expect(() =>
        assertIaCOptionsFlags([...command, ...options, ...files]),
      ).toThrow(FlagValueError);
    });

    it('throws an error if the scan flag has an unsupported value', () => {
      const options = ['--scan=rsrce-changes'];
      expect(() =>
        assertIaCOptionsFlags([...command, ...options, ...files]),
      ).toThrow(FlagValueError);
    });

    it.each([
      ['--scan=resource-changes', 'delta-scan'],
      ['--scan=planned-values', 'full-scan'],
    ])(
      'does not throw an error if the scan flag has a valid value of %s',
      (options) => {
        expect(() =>
          assertIaCOptionsFlags([...command, ...options, ...files]),
        ).not.toThrow(FlagValueError);
      },
    );
  });
});
