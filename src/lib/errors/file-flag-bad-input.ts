import {CustomError} from './custom-error';

export class FileFlagBadInputError extends CustomError {
    private static ERROR_CODE = 422;
    private static ERROR_MESSAGE = 'Empty --file argument. Did you mean --file=path/to/file ?';

    constructor() {
        super(FileFlagBadInputError.ERROR_MESSAGE);
        this.code = FileFlagBadInputError.ERROR_CODE;
        this.userMessage = FileFlagBadInputError.ERROR_MESSAGE;
    }
}
