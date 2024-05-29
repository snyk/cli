import {
  createFixture,
  inputA,
  inputB,
  ruleResultsNoPassedResults,
  ruleResultsNoResults,
  ruleResultsPassedResultsA,
  ruleResultsPassedResultsB,
  vulnerabilityA,
  vulnerabilityB,
} from './fixtures/snyc-iac-test-raw-result';
import { mapSnykIacTestOutputToTestOutput } from '../../../../../../../../src/lib/iac/test/v2/scan/results';

describe('mapSnykIacTestOutputToTestOutput', () => {
  const fixture = createFixture({
    vulnerabilities: [vulnerabilityA, vulnerabilityB],
    results: [
      {
        input: inputA,
        rule_results: [
          ruleResultsNoResults,
          ruleResultsNoPassedResults,
          ruleResultsPassedResultsA,
        ],
      },
      {
        input: inputB,
        rule_results: [ruleResultsPassedResultsB],
      },
    ],
  });
  const testOutput = mapSnykIacTestOutputToTestOutput(fixture);

  it('passes through the vulnerabilities from snyc-iac-test output', () => {
    expect(testOutput.results?.vulnerabilities).toEqual(
      fixture.results?.vulnerabilities,
    );
  });

  it('builds a list of passed vulnerabilities from the raw_results of snyc-iac-test output that contain "passed" results', () => {
    expect(testOutput.results?.passedVulnerabilities).toHaveLength(2);
    expect(testOutput.results?.passedVulnerabilities[0]).toMatchObject({
      resource: {
        file:
          inputA.resources.aws_s3_bucket['aws_s3_bucket.test-bucket0'].meta
            .location[0].filepath,
        id: ruleResultsPassedResultsA.results[0].resource_id,
      },
      rule: {
        id: ruleResultsPassedResultsA.id,
      },
    });
    expect(testOutput.results?.passedVulnerabilities[1]).toMatchObject({
      resource: {
        file:
          inputB.resources.aws_s3_bucket['aws_s3_bucket.test-bucket0'].meta
            .location[0].filepath,
        id: ruleResultsPassedResultsB.results[0].resource_id,
      },
      rule: {
        id: ruleResultsPassedResultsB.id,
      },
    });
  });
});
