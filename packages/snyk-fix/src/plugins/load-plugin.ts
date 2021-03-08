import { UnsupportedTypeError } from '../lib/errors/unsupported-type-error';
import { pythonFix } from './python';
import { FixHandler } from './types';

export function loadPlugin(type: string): FixHandler {
  switch (type) {
    case 'pip': {
      return pythonFix;
    }
    default: {
      throw new UnsupportedTypeError(type);
    }
  }
}
