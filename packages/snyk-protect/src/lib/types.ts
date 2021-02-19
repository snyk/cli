export interface PhysicalModuleToPatch {
  name: string;
  version: string;
  folderPath: string;
}

export interface PackageAndVersion {
  name: string;
  version: string;
}

export interface PatchDetails {
  comments: string[];
  diffs: string[];
  id: string;
  modifictionTime: string;
  urls: string[];
  version: string;
}
