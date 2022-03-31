export interface IGetAppsURLOpts {
  orgId?: string;
  clientId?: string;
}

interface IJSONApi {
  version: string;
}

export interface ICreateAppResponse {
  jsonapi: IJSONApi;
  data: {
    type: string;
    id: string;
    attributes: {
      name: string;
      clientId: string;
      redirectUris: string[];
      scopes: string[];
      isPublic: boolean;
      clientSecret: string;
    };
    links: {
      self: string;
    };
  };
}

export interface IRestErrorResponse {
  jsonapi: IJSONApi;
  errors: [
    {
      status: string;
      detail: string;
      source?: any;
      meta?: any;
    },
  ];
}

export interface IGenerateAppsOptions {
  interactive?: boolean;
}

export interface ICreateAppOptions extends IGenerateAppsOptions {
  org?: string;
  name?: string;
  redirectUris?: string;
  scopes?: string;
}

export interface ICreateAppRequest {
  orgId: string;
  snykAppName: string;
  snykAppRedirectUris: string[];
  snykAppScopes: string[];
}
