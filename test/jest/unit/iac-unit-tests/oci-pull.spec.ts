import * as OCIPull from '../../../../src/cli/commands/test/iac-local-execution/oci-pull';
import {
  CUSTOM_RULES_TARBALL,
  extractOCIRegistryURLComponents,
  FailedToBuildOCIArtifactError,
  InvalidRemoteRegistryURLError,
} from '../../../../src/cli/commands/test/iac-local-execution/oci-pull';
import registryClient from '@snyk/docker-registry-v2-client';
import { layers, manifest, opt } from './oci-pull.fixtures';
import { promises as fs } from 'fs';
import * as fileUtilsModule from '../../../../src/cli/commands/test/iac-local-execution/file-utils';
import * as measurableMethods from '../../../../src/cli/commands/test/iac-local-execution/measurable-methods';

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
  let getManifestSpy, getLayerSpy, writeSpy;

  beforeEach(() => {
    jest.restoreAllMocks();
    getManifestSpy = jest
      .spyOn(registryClient, 'getManifest')
      .mockResolvedValue(manifest);
    getLayerSpy = jest
      .spyOn(registryClient, 'getLayer')
      .mockResolvedValue(layers[0].blob);
  });

  it('pulls successfully', async () => {
    writeSpy = jest
      .spyOn(fs, 'writeFile')
      .mockImplementationOnce(() => Promise.resolve());
    jest
      .spyOn(measurableMethods, 'initLocalCache')
      .mockImplementationOnce(() => Promise.resolve());
    jest.spyOn(fileUtilsModule, 'createIacDir').mockImplementation(() => null);

    await OCIPull.pull(
      {
        registryBase: 'registry-1.docker.io',
        repo: 'accountName/custom-bundle-repo',
        tag: 'latest',
      },
      opt,
    );

    expect(getManifestSpy).toHaveBeenCalledWith(
      'registry-1.docker.io',
      'accountName/custom-bundle-repo',
      'latest',
      opt.username,
      opt.password,
      opt.reqOptions,
    );

    expect(getLayerSpy).toHaveBeenCalledWith(
      'registry-1.docker.io',
      'accountName/custom-bundle-repo',
      '',
      opt.username,
      opt.password,
      opt.reqOptions,
    );
    expect(writeSpy).toHaveBeenCalledWith(
      expect.stringContaining(CUSTOM_RULES_TARBALL),
      layers[0].blob,
    );
  });

  it('fails to pull with a FailedToBuildOCIArtifactError', async () => {
    writeSpy = jest.spyOn(fs, 'writeFile').mockImplementation(() => {
      throw new Error();
    });

    const pullResult = OCIPull.pull(
      {
        registryBase: 'registry-1.docker.io',
        repo: 'accountName/custom-bundle-repo',
        tag: 'latest',
      },
      opt,
    );

    await expect(pullResult).rejects.toThrow(FailedToBuildOCIArtifactError);
  });
});
