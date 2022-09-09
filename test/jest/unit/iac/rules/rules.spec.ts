import { initRules } from '../../../../../src/cli/commands/test/iac/local-execution/rules/rules';
import { config } from '../../../../../src/lib/user-config';

describe('initRules', () => {
  const registryBuilder = () => {
    throw new Error('should not be called');
  };

  const settings = {
    meta: {
      isPrivate: false,
      isLicensesEnabled: false,
      org: 'my-org',
      orgPublicId: '7bfa4159-6f90-4acd-82a4-0b2ad2aaf80b',
    },
    customPolicies: {},
    entitlements: {
      iacCustomRulesEntitlement: true,
    },
  };

  const options = {};

  beforeEach(() => {
    jest.spyOn(config, 'get').mockImplementation((key) => {
      switch (key) {
        case 'oci-registry-url':
          return 'https://example.com/registry';
        default:
          return '';
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should fail if an authentication error occurs', async () => {
    const registryBuilder = () => {
      return {
        getManifest() {
          const error = new Error('authentication error');
          Object.assign(error, { statusCode: 401 });
          throw error;
        },
        getLayer() {
          throw new Error('should not be called');
        },
      };
    };

    await expect(
      initRules(registryBuilder, settings, options, 'orgPublicId'),
    ).rejects.toThrow(
      'There was an authentication error. Incorrect credentials provided.',
    );
  });

  it('should fail if rules registry and custom rules are both provided', async () => {
    const options = {
      rules: 'path/to/rules.tgz',
    };

    await expect(
      initRules(registryBuilder, settings, options, 'orgPublicId'),
    ).rejects.toThrow('Could not execute custom rules mode');
  });

  it('should fail if the user is not entitled to use custom rules', async () => {
    const settings = {
      meta: {
        isPrivate: false,
        isLicensesEnabled: false,
        org: 'my-org',
        orgPublicId: '7bfa4159-6f90-4acd-82a4-0b2ad2aaf80b',
      },
      customPolicies: {},
      entitlements: {
        iacCustomRulesEntitlement: false,
      },
    };

    await expect(
      initRules(registryBuilder, settings, options, 'orgPublicId'),
    ).rejects.toThrow('Missing the iacCustomRulesEntitlement entitlement');
  });
});
