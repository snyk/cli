import { extractPatchMetadata } from '../../src/lib/snyk-file';

describe('extractPatchMetadata', () => {
  describe('extracts a single direct dependency', () => {
    it('without quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - lodash:
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });

    it('with single quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - 'lodash':
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });

    it('with double quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - "lodash":
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });

    it('with carriage returns in line endings', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - lodash:
        patched: '2021-02-17T13:43:51.857Z'
`
        .split('\n')
        .join('\r\n');
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });
  });

  describe('extracts a transitive dependency', () => {
    it('without quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - 'tap > nyc > lodash':
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });

    it('with single quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - 'tap > nyc > lodash':
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });

    it('with double quotes on package path', () => {
      const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - "tap > nyc > lodash":
        patched: '2021-02-17T13:43:51.857Z'
`;
      const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
      expect(snykFilePatchMetadata).toEqual([
        {
          vulnId: 'SNYK-JS-LODASH-567746',
          packageName: 'lodash',
        },
      ]);
    });
  });

  it('extracts multiple transitive dependencies', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - tap > nyc > istanbul-lib-instrument > babel-types > lodash:
        patched: '2021-02-17T13:43:51.857Z'

  SNYK-FAKE-THEMODULE-000000:
    - top-level > some-other > the-module:
        patched: '2021-02-17T13:43:51.857Z'
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    expect(snykFilePatchMetadata).toEqual([
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        packageName: 'lodash',
      },
      {
        vulnId: 'SNYK-FAKE-THEMODULE-000000',
        packageName: 'the-module',
      },
    ]);
  });

  it('extracts nothing from an empty patch section', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    expect(snykFilePatchMetadata).toHaveLength(0);
  });

  it('extracts nothing from a missing patch section', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    expect(snykFilePatchMetadata).toHaveLength(0);
  });

  it('throws when there are no package names for a vulnId in the patch section', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
`;

    expect(() => {
      extractPatchMetadata(dotSnykFileContents);
    }).toThrow(
      'should never have no package names for a vulnId in a .snyk file',
    );
  });

  it('throws when there is more than one package name for a vulnId in the patch section', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - lodash:
        patched: '2021-02-17T13:43:51.857Z'
    - axios:
        patched: '2021-02-17T13:43:51.857Z'
`;

    expect(() => {
      extractPatchMetadata(dotSnykFileContents);
    }).toThrow(
      'should never have more than one package name for a vulnId in a .snyk file',
    );
  });
});
