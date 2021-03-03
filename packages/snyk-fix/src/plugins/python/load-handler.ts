import { pipRequirementsTxt } from './handlers/pip-requirements';
import { SUPPORTED_PROJECT_TYPES } from './supported-project-types';

export function loadHandler(type: SUPPORTED_PROJECT_TYPES) {
  switch (type) {
    case SUPPORTED_PROJECT_TYPES.REQUIREMENTS: {
      return pipRequirementsTxt;
    }
    default: {
      throw new Error('No handler available for requested project type');
    }
  }
}
