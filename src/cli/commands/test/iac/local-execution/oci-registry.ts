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
  constructor(
    private registry: string,
    private username?: string,
    private password?: string,
    private options?: any,
  ) {}

  getManifest(repository: string, tag: string): Promise<GetManifestResponse> {
    return registryClient.getManifest(
      this.registry,
      repository,
      tag,
      this.username,
      this.password,
      this.options,
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
      this.options,
    );
    return { blob };
  }
}
