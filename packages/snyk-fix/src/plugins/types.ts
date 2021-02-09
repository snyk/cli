import { EntityToFix } from '../types';

export type FixHandler = (entities: EntityToFix[]) => Promise<FixHandlerResult[]>;

export interface FixHandlerResult {
  succeeded: EntityToFix[];
  failed: EntityToFix[];
}
