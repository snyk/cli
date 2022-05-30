import * as registryClient from '@snyk/docker-registry-v2-client';

export type GetManifestResponse = {
  schemaVersion: number;
  layers: Layer[];
};

export type Layer = {
  digest: string;
};

export type GetLayerResponse = {
  blob: Buffer;
};

export interface OciRegistry {
  getManifest(repository: string, tag: string): Promise<GetManifestResponse>;
  getLayer(repository: string, digest: string): Promise<GetLayerResponse>;
}

export class RemoteOciRegistry implements OciRegistry {
  private static options = {
    acceptManifest: 'application/vnd.oci.image.manifest.v1+json',
    acceptLayers: 'application/vnd.oci.image.layer.v1.tar+gzip',
  };

  constructor(
    private registry: string,
    private username?: string,
    private password?: string,
  ) {}

  getManifest(repository: string, tag: string): Promise<GetManifestResponse> {
    return registryClient.getManifest(
      this.registry,
      repository,
      tag,
      this.username,
      this.password,
      RemoteOciRegistry.options,
    );
  }

  async getLayer(
    repository: string,
    digest: string,
  ): Promise<GetLayerResponse> {
    const blob = await registryClient.getLayer(
      this.registry,
      repository,
      digest,
      this.username,
      this.password,
      RemoteOciRegistry.options,
    );
    return { blob };
  }
}
