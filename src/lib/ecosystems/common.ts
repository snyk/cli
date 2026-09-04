import { Ecosystem } from './types';

export function isUnmanagedEcosystem(ecosystem: Ecosystem): boolean {
  return ecosystem === 'cpp';
}
