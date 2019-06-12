export interface InspectResult {
  plugin: {
    name: string;
    runtime?: string;
  };
  package: any;
}

export interface Options {
  file?: string;
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean | 'true' | 'false';
  multiDepRoots?: boolean;
  debug?: boolean;
  packageManager?: string;
  composerIsFine?: boolean;
  composerPharIsFine?: boolean;
  systemVersions?: object;
}

export interface Plugin {
  inspect: (root: string, targetFile: string, options?: Options) => Promise<InspectResult>;
}
