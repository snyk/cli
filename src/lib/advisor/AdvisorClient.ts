import { Package, ScoredPackage } from '../../cli/commands/advise/types';

export class AdvisorClient {
  scorePackages(packages: Package[]): Promise<ScoredPackage[]> {
    const scoredPackages: ScoredPackage[] = packages.map(aPackage => ({
      name: aPackage.name,
      score: 88,
    }))
    return Promise.resolve(scoredPackages);
  }
}
