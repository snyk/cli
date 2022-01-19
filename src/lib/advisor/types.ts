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
  INACTIVE = 0,
  SUSTAINABLE = 1,
  HEALTHY = 2,
}

export const maintenanceFromString = (label: string): Maintenance => {
  switch(label) {
    case 'Inactive': return Maintenance.INACTIVE
    case 'Sustainable': return Maintenance.SUSTAINABLE
    case 'Healthy': return Maintenance.HEALTHY
  }
  throw new Error("Unknown maintenance label " + label);
}
