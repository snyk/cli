export interface InspectResult {
  plugin: {
    name: string;
    runtime?: string;
  };
  package?: any;
  scannedProjects?: any;
}

export interface Options {
  file?: string;
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean;
  allSubProjects?: boolean;
  debug?: boolean;
  packageManager?: string;
  composerIsFine?: boolean;
  composerPharIsFine?: boolean;
  systemVersions?: any;
  scanAllUnmanaged?: boolean;
}

export interface Plugin {
  inspect: (
    root: string,
    targetFile: string,
    options?: Options,
  ) => Promise<InspectResult>;
}
