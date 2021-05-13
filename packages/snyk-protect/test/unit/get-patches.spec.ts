import { getPatches } from '../../src/lib/get-patches';
import { PackageAndVersion } from '../../src/lib/types';

// TODO: lower it once Protect stops hitting real Snyk API endpoints
const testTimeout = 30000;

// These tests makes a real API calls to Snyk
// TODO: would be better to mock the response
describe(getPatches.name, () => {
  it(
    'seems to work',
    async () => {
      const packageAndVersions: PackageAndVersion[] = [
        {
          name: 'lodash',
          version: '4.17.15',
        } as PackageAndVersion,
      ];
      const vulnIds = ['SNYK-JS-LODASH-567746'];
      const patches = await getPatches(packageAndVersions, vulnIds);
      expect(Object.keys(patches)).toEqual(['lodash']);
      const lodashPatches = patches['lodash'];
      expect(lodashPatches).toHaveLength(1);
      const theOnePatch = lodashPatches[0];
      expect(theOnePatch.id).toBe('patch:SNYK-JS-LODASH-567746:0');
      expect(theOnePatch.diffs).toHaveLength(1);
      expect(theOnePatch.diffs[0]).toContain('index 9b95dfef..43e71ffb 100644'); // something from the actual patch
    },
    testTimeout,
  );

  it(
    'does not download patch for non-applicable version',
    async () => {
      const packageAndVersions: PackageAndVersion[] = [
        {
          name: 'lodash',
          version: '4.17.20', // this version is not applicable to the patch
        } as PackageAndVersion,
      ];
      const vulnIds = ['SNYK-JS-LODASH-567746'];
      const patches = await getPatches(packageAndVersions, vulnIds);
      expect(patches).toEqual({}); // expect nothing to be returned because SNYK-JS-LODASH-567746 does not apply to 4.17.20 of lodash
    },
    testTimeout,
  );
});
