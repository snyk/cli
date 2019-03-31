export interface InspectResult {
  plugin: {
    name: string;
    runtime: string;
  };
  package: any;
}

export interface Options {
  docker?: boolean;
  traverseNodeModules?: boolean;
  dev?: boolean;
  strictOutOfSync?: boolean | 'true' | 'false';
}

export interface Plugin {
  inspect: (root: string, targetFile: string, options?: Options) => Promise<InspectResult>;
}
