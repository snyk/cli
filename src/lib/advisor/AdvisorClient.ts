import { Package, ScoredPackage, maintenanceFromString } from './types';
import { getAuthHeader } from '../api-token';
import * as needle from 'needle';

export class AdvisorClient {
  async scorePackages(packages: Package[]): Promise<ScoredPackage[]> {
    const response = await post({
      url: 'https://api.snyk.io/unstable/advisor/scores/npm-package',
      body: packages.map((aPackage) => aPackage.name),
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
    });

    const body = response.body as AdvisorResponse[];

    return body.map(convertAdvisorResponse);
  }
}

const convertAdvisorResponse = (response: AdvisorResponse): ScoredPackage => {
  return {
    name: response.name,
    score: Math.round(100 * response.score),
    maintenance: maintenanceFromString(response.labels.maintenance),
    popularity: response.labels.popularity,
  };
};

type Request = {
  url: string;
  body: any;
  headers: any;
};

const post = ({ url, body, headers }: Request): Promise<any> => {
  return new Promise((resolve, reject) => {
    needle.request('post', url, body, { headers }, (err, res, respBody) => {
      if (err) {
        return reject(err);
      }

      resolve({ res, body: respBody });
    });
  });
};

interface AdvisorResponse {
  name: string;
  score: number;
  pending: boolean;
  labels: AdvisorLabels;
}

interface AdvisorLabels {
  popularity: string;
  maintenance: string;
  community: string;
  security: string;
}
