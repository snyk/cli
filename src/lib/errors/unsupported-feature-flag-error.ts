import {CustomError} from './custom-error';

export class UnsupportedFeatureFlagError extends CustomError {
    private static ERROR_CODE: number = 403;

    constructor(featureFlag: string, userMessage =
        `Feature flag '${featureFlag}' is not currently enabled for your org, to enable please contact snyk support`) {
        super(userMessage);
        this.userMessage = userMessage;
        this.code = UnsupportedFeatureFlagError.ERROR_CODE;
    }
}
