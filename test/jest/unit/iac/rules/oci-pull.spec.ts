import * as OCIPull from '../../../../../src/cli/commands/test/iac/local-execution/rules/oci-pull';
import {
  CUSTOM_RULES_TARBALL,
  extractOCIRegistryURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidRemoteRegistryURLError,
} from '../../../../../src/cli/commands/test/iac/local-execution/rules/oci-pull';
import { promises as fs } from 'fs';
import * as fileUtilsModule from '../../../../../src/cli/commands/test/iac/local-execution/file-utils';
import * as measurableMethods from '../../../../../src/cli/commands/test/iac/local-execution/measurable-methods';
import { OciRegistry } from '../../../../../src/cli/commands/test/iac/local-execution/oci-registry';

describe('extractOCIRegistryURLComponents', () => {
  it('extracts baseURL, repo and tag from an OCI URL', async () => {
    const expected = extractOCIRegistryURLComponents(
      'https://registry-1.docker.io/accountName/bundle-test:latest',
    );
    expect(expected).toEqual({
      registryBase: 'registry-1.docker.io',
      repo: 'accountName/bundle-test',
      tag: 'latest',
    });
  });

  it('extracts components from URL without protocol', async () => {
    const expected = extractOCIRegistryURLComponents(
      'gcr.io/user/repo-test:0.5.2',
    );
    expect(expected).toEqual({
      registryBase: 'gcr.io',
      repo: 'user/repo-test',
      tag: '0.5.2',
    });
  });

  it('extracts components and a versioned tag', async () => {
    const expected = extractOCIRegistryURLComponents(
      'https://gcr.io/user/repo-test:0.5.2',
    );
    expect(expected).toEqual({
      registryBase: 'gcr.io',
      repo: 'user/repo-test',
      tag: '0.5.2',
    });
  });

  it('extracts components when no account provided', async () => {
    const expected = extractOCIRegistryURLComponents(
      'https://gcr.io/repo-test:0.5.2',
    );
    expect(expected).toEqual({
      registryBase: 'gcr.io',
      repo: 'repo-test',
      tag: '0.5.2',
    });
  });

  it('extracts components and a latest tag, when tag is undefined', async () => {
    const expected = extractOCIRegistryURLComponents(
      'https://gcr.io/user/repo-test',
    );
    expect(expected).toEqual({
      registryBase: 'gcr.io',
      repo: 'user/repo-test',
      tag: 'latest',
    });
  });

  it('throws an error if a URL with an empty registry host is provided', function() {
    expect(() => {
      extractOCIRegistryURLComponents('https:///repository:0.2.0');
    }).toThrow(InvalidRemoteRegistryURLError);
  });

  it('throws an error if a URL without a path is provided', function() {
    expect(() => {
      extractOCIRegistryURLComponents('https://registry');
    }).toThrow(InvalidRemoteRegistryURLError);
  });

  it('throws an error if a URL with an empty path is provided', function() {
    expect(() => {
      extractOCIRegistryURLComponents('https://registry/');
    }).toThrow(InvalidRemoteRegistryURLError);
  });

  it('throws an error if a URL with an empty repository name is provided', function() {
    expect(() => {
      extractOCIRegistryURLComponents('https://registry/:');
    }).toThrow(InvalidRemoteRegistryURLError);
  });
});

describe('pull', () => {
  const config = {
    mediaType: '',
    size: 50,
    digest:
      'sha256:db5t678c2946ae8c52553519a93bf5bc09c2df3e7f48cfb28acb258c91c67ee1',
  };

  const manifest = {
    schemaVersion: 2,
    mediaType: 'la',
    config,
    layers: [
      {
        mediaType: 'application/vnd.oci.image.layer.v1.tar+gzip',
        digest: '',
        size: 50000,
      },
    ],
  };

  const blob = Buffer.from('text');

  const layers = [
    {
      config,
      blob,
    },
  ];

  const registry: OciRegistry = {
    getManifest: jest.fn(async () => manifest),
    getLayer: jest.fn(async () => ({ blob })),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('pulls successfully', async () => {
    const writeSpy = jest
      .spyOn(fs, 'writeFile')
      .mockImplementationOnce(() => Promise.resolve());
    jest
      .spyOn(measurableMethods, 'initLocalCache')
      .mockImplementationOnce(() => Promise.resolve());
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);

    await OCIPull.pull(registry, 'accountName/custom-bundle-repo', 'latest');

    expect(registry.getManifest).toHaveBeenCalledWith(
      'accountName/custom-bundle-repo',
      'latest',
    );

    expect(registry.getLayer).toHaveBeenCalledWith(
      'accountName/custom-bundle-repo',
      '',
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining(CUSTOM_RULES_TARBALL),
      layers[0].blob,
    );
  });

  it('fails to pull with a FailedToBuildOCIArtifactError', async () => {
    jest.spyOn(fs, 'writeFile').mockImplementation(() => {
      throw new Error();
    });

    const pullResult = OCIPull.pull(
      registry,
      'accountName/custom-bundle-repo',
      'latest',
    );

    await expect(pullResult).rejects.toThrow(FailedToBuildOCIArtifactError);
  });
});
