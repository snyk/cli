import { Package, ScoredPackage } from '../types';

export interface AdvisorClient {
  scorePackages(packages: Package[]): Promise<ScoredPackage[]>;
}
