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
    stdout: string,
    jsonResult?: string,
    sarifResult?: string,
  ): JsonTestCommandResult {
    return new JsonTestCommandResult(stdout, jsonResult, sarifResult);
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
  constructor(stdout: string, jsonResult?: string, sarifResult?: string) {
    super(stdout);
    if (jsonResult) {
      this.jsonResult = jsonResult;
    }
    if (sarifResult) {
      this.sarifResult = sarifResult;
    } else {
      this.jsonResult = stdout;
    }
  }

  public getJsonResult(): string {
    return this.jsonResult;
  }

  public getSarifResult(): string {
    return this.sarifResult;
  }
}

export interface IgnoreMetadata {
  reason: string;
  expires: Date;
  created: Date;
}

export interface IgnoreRulePathData {
  [path: string]: IgnoreMetadata;
}

export interface IgnoreRules {
  [issueId: string]: IgnoreRulePathData[];
}
