import { pipRequirementsTxt } from './handlers/pip-requirements';
import { pipenvPipfile } from './handlers/pipenv-pipfile';

import { SUPPORTED_HANDLER_TYPES } from './supported-handler-types';

export function loadHandler(type: SUPPORTED_HANDLER_TYPES) {
  switch (type) {
    case SUPPORTED_HANDLER_TYPES.REQUIREMENTS: {
      return pipRequirementsTxt;
    }
    case SUPPORTED_HANDLER_TYPES.PIPFILE: {
      return pipenvPipfile;
    }
    default: {
      throw new Error('No handler available for requested project type');
    }
  }
}
