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
  protected jsonData = {};

  public getJsonResult(): string {
    return this.jsonResult;
  }

  public getSarifResult(): string {
    return this.sarifResult;
  }

  public getJsonData(): Record<string, unknown> {
    return this.jsonData;
  }

  public static createHumanReadableTestCommandResult(
    humanReadableResult: string,
    jsonResult: string,
    sarifResult?: string,
    jsonData?: Record<string, unknown>,
  ): HumanReadableTestCommandResult {
    return new HumanReadableTestCommandResult(
      humanReadableResult,
      jsonResult,
      sarifResult,
      jsonData,
    );
  }

  public static createJsonTestCommandResult(
    stdout: string,
    jsonResult?: string,
    sarifResult?: string,
    jsonPayload?: Record<string, unknown>
  ): JsonTestCommandResult {
    return new JsonTestCommandResult(stdout, jsonResult, sarifResult, jsonPayload);
  }
}

class HumanReadableTestCommandResult extends TestCommandResult {
  protected jsonResult = '';
  protected sarifResult = '';
  protected jsonData = {};

  constructor(
    humanReadableResult: string,
    jsonResult: string,
    sarifResult?: string,
    jsonData?: Record<string, unknown>,
  ) {
    super(humanReadableResult);
    this.jsonResult = jsonResult;
    if (sarifResult) {
      this.sarifResult = sarifResult;
    }
    if (jsonData) {
      this.jsonData = jsonData;
    }
  }

  public getJsonResult(): string {
    return this.jsonResult;
  }

  public getSarifResult(): string {
    return this.sarifResult;
  }

  public getJsonData(): Record<string, unknown> {
    return this.jsonData;
  }
}

class JsonTestCommandResult extends TestCommandResult {
  constructor(stdout: string, jsonResult?: string, sarifResult?: string, jsonData?: Record<string, unknown>) {
    super(stdout);
    if (jsonResult) {
      this.jsonResult = jsonResult;
    }
    if (sarifResult) {
      this.sarifResult = sarifResult;
    } else {
      this.jsonResult = stdout;
    }
    if (jsonData) {
      this.jsonData = jsonData;
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
