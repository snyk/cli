import {CustomError} from './custom-error';

export class MonitorError extends CustomError {
    private static ERROR_MESSAGE: string =
        'Server returned unexpected error for the monitor request. ';

    constructor(errorCode, message) {
        super(MonitorError.ERROR_MESSAGE +
          `Status code: ${errorCode}, response: ${message}`);
        this.code = errorCode;
        this.userMessage = message;
    }
}
