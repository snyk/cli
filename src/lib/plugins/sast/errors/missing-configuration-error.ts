import { CustomError } from '../../../errors/custom-error';

export class MissingConfigurationError extends CustomError {
  public readonly action: string;

  constructor(action: string, additionalUserHelp = '') {
    super(`Missing configuration for ${action}.`);
    this.code = 422;
    this.action = action;

    this.userMessage = `'Configuration is missing or wrong for ${action}'. ${additionalUserHelp}`;
  }
}
