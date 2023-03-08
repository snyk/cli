export type AppContext = 'tenant' | 'user';

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
      client_id: string;
      redirect_uris: string[];
      scopes: string[];
      is_public: boolean;
      client_secret: string;
      access_token_ttl_seconds: number;
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
  context?: AppContext;
}

export interface ICreateAppRequest {
  orgId: string;
  snykAppName: string;
  snykAppRedirectUris: string[];
  snykAppScopes: string[];
  context?: AppContext;
}
