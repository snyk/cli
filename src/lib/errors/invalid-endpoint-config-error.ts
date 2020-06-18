import { CustomError } from './custom-error';

export class InvalidEndpointConfigError extends CustomError {
  private static ERROR_MESSAGE =
    "Invalid 'endpoint' config option. Endpoint must be a full and valid URL including protocol and for Snyk.io it should contain path to '/api'";

  constructor() {
    super(InvalidEndpointConfigError.ERROR_MESSAGE);
  }
}
