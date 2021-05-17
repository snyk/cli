import { extractPatchMetadata } from '../../src/lib/snyk-file';

describe(extractPatchMetadata.name, () => {
  it('extracts a direct dependency', () => {
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
    const vulnIds = Object.keys(snykFilePatchMetadata);

    // can't use .flat() because it's not supported in Node 10
    const packageNames: string[] = [];
    for (const nextArrayOfPackageNames of Object.values(
      snykFilePatchMetadata,
    )) {
      packageNames.push(...nextArrayOfPackageNames);
    }

    expect(vulnIds).toEqual(['SNYK-JS-LODASH-567746']);
    expect(packageNames).toEqual(['lodash']);
  });

  it('extracts a transitive dependency', () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
  SNYK-JS-LODASH-567746:
    - tap > nyc > istanbul-lib-instrument > babel-types > lodash:
        patched: '2021-02-17T13:43:51.857Z'
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    const vulnIds = Object.keys(snykFilePatchMetadata);

    // can't use .flat() because it's not supported in Node 10
    const packageNames: string[] = [];
    for (const nextArrayOfPackageNames of Object.values(
      snykFilePatchMetadata,
    )) {
      packageNames.push(...nextArrayOfPackageNames);
    }

    expect(vulnIds).toEqual(['SNYK-JS-LODASH-567746']);
    expect(packageNames).toEqual(['lodash']);
  });

  it('extracts multiple transitive dependencies', async () => {
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
    const vulnIds = Object.keys(snykFilePatchMetadata);

    // can't use .flat() because it's not supported in Node 10
    const packageNames: string[] = [];
    for (const nextArrayOfPackageNames of Object.values(
      snykFilePatchMetadata,
    )) {
      packageNames.push(...nextArrayOfPackageNames);
    }

    expect(vulnIds).toEqual([
      'SNYK-JS-LODASH-567746',
      'SNYK-FAKE-THEMODULE-000000',
    ]);
    expect(packageNames).toEqual(['lodash', 'the-module']);
  });

  it('extracts nothing from an empty patch section', async () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
# patches apply the minimum changes required to fix a vulnerability
patch:
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    const vulnIds = Object.keys(snykFilePatchMetadata);

    // can't use .flat() because it's not supported in Node 10
    const packageNames: string[] = [];
    for (const nextArrayOfPackageNames of Object.values(
      snykFilePatchMetadata,
    )) {
      packageNames.push(...nextArrayOfPackageNames);
    }

    expect(vulnIds).toHaveLength(0);
    expect(packageNames).toHaveLength(0);
  });

  it('extracts nothing from a missing patch section', async () => {
    const dotSnykFileContents = `
# Snyk (https://snyk.io) policy file, patches or ignores known vulnerabilities.
version: v1.19.0
ignore: {}
`;
    const snykFilePatchMetadata = extractPatchMetadata(dotSnykFileContents);
    const vulnIds = Object.keys(snykFilePatchMetadata);

    // can't use .flat() because it's not supported in Node 10
    const packageNames: string[] = [];
    for (const nextArrayOfPackageNames of Object.values(
      snykFilePatchMetadata,
    )) {
      packageNames.push(...nextArrayOfPackageNames);
    }

    expect(vulnIds).toHaveLength(0);
    expect(packageNames).toHaveLength(0);
  });
});
