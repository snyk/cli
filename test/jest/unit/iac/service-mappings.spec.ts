import {
  createIgnorePattern,
  createIgnorePatternWithMap,
  InvalidServiceError,
  services2resources,
  verifyServiceMappingExists,
} from '../../../../src/lib/iac/service-mappings';

describe('service-mappings', function() {
  describe('validation', function() {
    it('throws an error when an unknown service is used', function() {
      expect(() => {
        verifyServiceMappingExists(['no-such-service']);
      }).toThrow(InvalidServiceError);
    });
    it('throws an error when an empty service list is used', function() {
      expect(() => {
        verifyServiceMappingExists([]);
      }).toThrow(InvalidServiceError);
    });
    it('does not throw an error when a known service is used', function() {
      expect(() => {
        verifyServiceMappingExists(Array.from(services2resources.keys()));
      }).not.toThrow(InvalidServiceError);
    });
  });

  describe('ignore pattern creation', function() {
    it('should create the correct pattern', function() {
      const service = Array.from(services2resources.keys())[0];
      const pattern = createIgnorePattern([service]);
      let expected = '*';
      services2resources
        .get(service)
        ?.forEach((s) => (expected = expected.concat(',!').concat(s)));
      expect(pattern).toBe(expected);
    });

    it('should not include the same ignore pattern replicated multiple times', function() {
      const services = new Map<string, Array<string>>([
        ['service1', ['duplicate']],
        ['service2', ['duplicate']],
      ]);
      const pattern = createIgnorePatternWithMap(
        ['service1', 'service2'],
        services,
      );
      expect(pattern).toBe(`*,!duplicate`);
    });
  });
});
