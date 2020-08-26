export type MethodResult = CommandResult | string | void;

export class CommandResult {
  result: string;
  constructor(result: string) {
    this.result = result;
  }

  public toString(): string {
    return this.result;
  }

  public getDisplayResults() {
    return this.result;
  }
}

export abstract class TestCommandResult extends CommandResult {
  protected jsonResult = '';
  protected sarifResult = '';

  public getJsonResult(): string {
    return this.jsonResult;
  }

  public getSarifResult(): string {
    return this.sarifResult;
  }

  public static createHumanReadableTestCommandResult(
    humanReadableResult: string,
    jsonResult: string,
    sarifResult?: string,
  ): HumanReadableTestCommandResult {
    return new HumanReadableTestCommandResult(
      humanReadableResult,
      jsonResult,
      sarifResult,
    );
  }

  public static createJsonTestCommandResult(
    jsonResult: string,
  ): JsonTestCommandResult {
    return new JsonTestCommandResult(jsonResult);
  }
}

class HumanReadableTestCommandResult extends TestCommandResult {
  protected jsonResult = '';
  protected sarifResult = '';

  constructor(
    humanReadableResult: string,
    jsonResult: string,
    sarifResult?: string,
  ) {
    super(humanReadableResult);
    this.jsonResult = jsonResult;
    if (sarifResult) {
      this.sarifResult = sarifResult;
    }
  }

  public getJsonResult(): string {
    return this.jsonResult;
  }

  public getSarifResult(): string {
    return this.sarifResult;
  }
}

class JsonTestCommandResult extends TestCommandResult {
  constructor(jsonResult: string) {
    super(jsonResult);
  }

  public getJsonResult(): string {
    return this.result;
  }
}
