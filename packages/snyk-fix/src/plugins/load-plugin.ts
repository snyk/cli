import { UnsupportedTypeError } from '../lib/errors/unsupported-type-error';
import { pythonFix } from './python';
import { nodeFix } from './node';
import { FixHandler } from './types';

export function loadPlugin(type: string): FixHandler {
  switch (type) {
    case 'pip': {
      return pythonFix;
    }
    case 'poetry': {
      return pythonFix;
    }
    case 'npm': {
      return nodeFix;
    }
    default: {
      throw new UnsupportedTypeError(type);
    }
  }
}
