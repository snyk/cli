export type Package = {
  name: string;
}

export type ScoredPackage = Package & {
  score: number;
  maintenance: Maintenance,
}

export type AdviseResult = {
  dependencies: ScoredPackage[];
}

export enum Maintenance {
  HEALTHY = 'Healthy',
  INACTIVE = 'Inactive',
  SUSTAINABLE = 'Sustainable',
}
