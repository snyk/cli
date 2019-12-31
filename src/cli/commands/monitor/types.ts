import { MonitorError } from '../../../lib/errors';

export interface GoodResult {
  ok: true;
  data: string;
  path: string;
  projectName?: string;
}

export interface BadResult {
  ok: false;
  data: MonitorError;
  path: string;
}
