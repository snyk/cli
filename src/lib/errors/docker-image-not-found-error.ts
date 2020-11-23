import { CustomError } from './custom-error';

export class DockerImageNotFoundError extends CustomError {
  private static ERROR_CODE = 404;

  constructor(image: string) {
    const message = `Failed to scan image "${image}". Please make sure the image and/or repository exist, and that you are using the correct credentials.`;
    super(message);
    this.code = DockerImageNotFoundError.ERROR_CODE;
    this.userMessage = message;
  }
}
