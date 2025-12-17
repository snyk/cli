import { npm } from './handlers/npm';
import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

export function loadHandler(type: SUPPORTED_HANDLER_TYPES) {
  switch (type) {
    case SUPPORTED_HANDLER_TYPES.NPM: {
      return npm;
    }
    default: {
      throw new Error('No handler available for requested project type');
    }
  }
}

