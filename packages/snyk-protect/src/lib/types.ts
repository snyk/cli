export type PatchInfo = {
  patchableVersions?: string;
  urls: string[];
};

export type VulnIdAndPackageName = {
  vulnId: string;
  packageName: string;
};

export type FoundPhysicalPackage = {
  packageName: string;
  packageVersion: string;
  path: string;
};

export type Patch = {
  patchableVersions?: string;
  patchDiffs: string[];
};

export type VulnPatches = {
  vulnId: string;
  patches: Patch[];
};
