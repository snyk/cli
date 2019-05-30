import {CustomError} from './custom-error';

export class FileFlagBadInputError extends CustomError {
    private static ERROR_CODE: number = 422;
    private static ERROR_MESSAGE: string = 'Empty --file argument. Did you mean --file=path/to/file ?';

    constructor() {
        super(FileFlagBadInputError.ERROR_MESSAGE);
        this.code = FileFlagBadInputError.ERROR_CODE;
        this.userMessage = FileFlagBadInputError.ERROR_MESSAGE;
    }
}
