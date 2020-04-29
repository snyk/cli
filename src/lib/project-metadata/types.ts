export interface GitTarget {
  remoteUrl?: string;
  branch?: string;
}

export interface ContainerTarget {
  image?: string;
}

export function isGitTarget(target: any): target is GitTarget {
  return target && (target.branch || target.remoteUrl);
}
