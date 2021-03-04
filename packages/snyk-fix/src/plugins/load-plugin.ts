import { UnsupportedTypeError } from '../lib/errors/unsupported-type-error';
import { pythonFix } from './python';

export function loadPlugin(type: string) {
  switch (type) {
    case 'pip': {
      return pythonFix;
    }
    default: {
      throw new UnsupportedTypeError(type);
    }
  }
}
