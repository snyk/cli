import { AdvisorClient } from './AdvisorClient';
import { Package, ScoredPackage } from '../types';

export class FakeAdvisorClient implements AdvisorClient {
  scorePackages(packages: Package[]): Promise<ScoredPackage[]> {
    const scoredPackages: ScoredPackage[] = packages.map(aPackage => ({
      name: aPackage.name,
      score: 88,
    }))
    return Promise.resolve(scoredPackages);
  }

}
