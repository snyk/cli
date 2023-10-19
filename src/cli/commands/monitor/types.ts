import { ProblemError } from '@snyk/error-catalog-nodejs-public';

export interface GoodResult {
  ok: true;
  data: string;
  path: string;
  projectName?: string;
}

export interface BadResult {
  ok: false;
  data: ProblemError;
  path: string;
}
