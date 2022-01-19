import { Maintenance, ScoredPackage } from './types';

export const shouldDisplay = (dependency: ScoredPackage, acceptableScore: number | null, acceptableMaintenance: Maintenance | null): boolean => {
  if(acceptableScore !== null && dependency.score >= acceptableScore) return false;
  if(acceptableMaintenance !== null && dependency.maintenance >= acceptableMaintenance) return false;
  return true;
}
