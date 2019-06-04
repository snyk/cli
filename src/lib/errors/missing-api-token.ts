import {CustomError} from './custom-error';

export class MissingApiTokenError extends CustomError {
    private static ERROR_CODE: number = 401;
    private static ERROR_STRING_CODE: string = 'NO_API_TOKEN';
    private static ERROR_MESSAGE: string =
        '`snyk` requires an authenticated account. Please run `snyk auth` and try again.';

    constructor() {
        super(MissingApiTokenError.ERROR_MESSAGE);
        this.code = MissingApiTokenError.ERROR_CODE;
        this.strCode = MissingApiTokenError.ERROR_STRING_CODE;
        this.userMessage = MissingApiTokenError.ERROR_MESSAGE;
    }
}
