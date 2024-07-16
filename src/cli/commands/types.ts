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

export type JsonDocument = Record<string, undefined> | Array<JsonDocument>;

export abstract class TestCommandResult extends CommandResult {
  protected jsonData?: JsonDocument;
  protected sarifData?: JsonDocument;

  public getJsonData(): JsonDocument | undefined {
    return this.jsonData;
  }

  public getSarifData(): JsonDocument | undefined {
    return this.sarifData;
  }

  public static createHumanReadableTestCommandResult(
    humanReadableResult: string,
    jsonData?: JsonDocument,
    sarifData?: JsonDocument,
  ): HumanReadableTestCommandResult {
    return new HumanReadableTestCommandResult(
      humanReadableResult,
      jsonData,
      sarifData,
    );
  }

  public static createJsonTestCommandResult(
    jsonData?: JsonDocument,
    sarifData?: JsonDocument,
  ): JsonTestCommandResult {
    return new JsonTestCommandResult(
      '',
      jsonData,
      sarifData,
    );
  }
}

class HumanReadableTestCommandResult extends TestCommandResult {
  constructor(
    humanReadableResult: string,
    jsonData?: JsonDocument,
    sarifData?: JsonDocument,
  ) {
    super(humanReadableResult);
    this.jsonData = jsonData;
    this.sarifData = sarifData;
  }
}

class JsonTestCommandResult extends TestCommandResult {
  constructor(
    stdout: string,
    jsonData?: JsonDocument,
    sarifData?: JsonDocument,
  ) {
    super(stdout);
    this.jsonData = jsonData;
    this.sarifData = sarifData;
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
