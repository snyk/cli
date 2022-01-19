export type Package = {
  name: string;
};

export type ScoredPackage = Package & {
  score: number;
  maintenance: Maintenance;
  popularity: string;
};

export type AdviseResult = {
  dependencies: ScoredPackage[];
};

export enum Maintenance {
  HEALTHY = 'Healthy',
  INACTIVE = 'Inactive',
  SUSTAINABLE = 'Sustainable',
}
