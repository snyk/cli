
import { SnykIacTestOutput, Vulnerability } from "../../../../../../../../../src/lib/iac/test/v2/scan/results";
import { SEVERITY } from "../../../../../../../../../src/lib/snyk-test/common";
import { IacProjectType } from "../../../../../../../../../src/lib/iac/constants";
import { Results, State, RuleResult, Result } from "../../../../../../../../../src/lib/iac/test/v2/scan/policy-engine";

export const vulnerabilityA = {
  rule: {
    id: "SNYK-CC-00021",
    title: "S3 server access logging is disabled",
    description: "description",
    references: "https://docs.aws.amazon.com/AmazonS3/latest/dev/ServerLogs.html",
    labels: [
      "access",
    ],
    category: "logging",
    documentation: "https://security.snyk.io/rules/cloud/SNYK-CC-00021",
  },
  message: "",
  remediation: "remedy",
  severity: SEVERITY.MEDIUM,
  ignored: false,
  resource: {
    id: "aws_s3_bucket.test-bucket0",
    type: "aws_s3_bucket",
    kind: IacProjectType.TERRAFORM,
    path: [
      "logging",
    ],
    formattedPath: "resource.aws_s3_bucket[test-bucket0].logging",
    file: "main.tf",
    line: 1,
    column: 1,
  },
}

export const vulnerabilityB = {
  rule: {
    id: "SNYK-CC-00023",
    title: "S3 bucket versioning is disabled",
    description: "description",
    references: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html",
    labels: [
      "storage",
    ],
    category: "general",
    documentation: "https://security.snyk.io/rules/cloud/SNYK-CC-00023",
  },
  message: "",
  remediation: "remedy",
  severity: SEVERITY.MEDIUM,
  ignored: false,
  resource: {
    id: "aws_s3_bucket.test-bucket0",
    type: "aws_s3_bucket",
    kind: IacProjectType.TERRAFORM,
    path: [
      "versioning",
    ],
    formattedPath: "resource.aws_s3_bucket[test-bucket0].versioning",
    file: "secondary.tf",
    line: 1,
    column: 1,
  },
}

export const inputA =  {
  format: State.FormatEnum.State,
  format_version: State.FormatVersionEnum._100,
  input_type: State.InputTypeEnum.TfHcl,
  environment_provider: State.EnvironmentProviderEnum.Iac,
  meta: {
    filepath: ".",
  },
  resources: {
    aws_s3_bucket: {
      "aws_s3_bucket.test-bucket0": {
        id: "aws_s3_bucket.test-bucket0",
        resource_type: "aws_s3_bucket",
        namespace: ".",
        tags: {
          Environment: "Dev",
          Name: "test",
        },
        meta: {
          location: [
            {
              filepath: "main.tf",
              line: 1,
              column: 1,
            },
          ],
        },
        attributes: {},
      },
    },
  }
}

export const ruleResultsNoResults = {
  id: "SNYK-CC-00001",
  title: "RDS database instance is publicly accessible",
  platform: [
    "aws",
  ],
  description: "description",
  category: "data",
  labels: [
    "access-control",
    "databases",
    "public-access",
  ],
  service_group: "RDS",
  resource_types: [
    "aws_db_instance",
  ],
  results: []
}

export const ruleResultsNoPassedResults = {
  id: "SNYK-CC-00021",
  title: "S3 server access logging is disabled",
  platform: [
    "aws",
  ],
  description: "description",
  category: "logging",
  labels: [
    "access",
  ],
  service_group: "S3",
  resource_types: [
    "aws_s3_bucket",
  ],
  results: [
    {
      passed: false,
      ignored: false,
      resource_id: "aws_s3_bucket.test-bucket0",
      resource_namespace: ".",
      resource_type: "aws_s3_bucket",
      remediation: "remedy",
      severity: RuleResult.SeverityEnum.Medium,
      resources: [
        {
          id: "aws_s3_bucket.test-bucket0",
          type: "aws_s3_bucket",
          namespace: ".",
          location: [
            {
              filepath: "main.tf",
              line: 1,
              column: 1,
            },
          ],
          attributes: [
            {
              path: [
                "logging",
              ],
              location: {
                filepath: "main.tf",
                line: 1,
                column: 1,
              },
            },
          ],
        },
      ],
    },
  ],
}

export const ruleResultsPassedResultsA = {
  id: "SNYK-CC-00022",
  title: "S3 bucket is not encrypted",
  platform: [
    "aws",
  ],
  description: "description",
  category: "data",
  labels: [
    "encryption-at-rest",
  ],
  service_group: "S3",
  resource_types: [
    "aws_s3_bucket",
  ],
  results: [
    {
      passed: true,
      ignored: false,
      resource_id: "aws_s3_bucket.test-bucket0",
      resource_namespace: ".",
      resource_type: "aws_s3_bucket",
      remediation: "remedy",
      severity: RuleResult.SeverityEnum.Medium,
      resources: [
        {
          id: "aws_s3_bucket.test-bucket0",
          type: "aws_s3_bucket",
          namespace: ".",
          location: [
            {
              filepath: "main.tf",
              line: 1,
              column: 1,
            },
          ],
        },
      ],
    },
  ],
}

export const inputB = {
  format: State.FormatEnum.State,
  format_version: State.FormatVersionEnum._100,
  input_type: State.InputTypeEnum.TfHcl,
  environment_provider: State.EnvironmentProviderEnum.Iac,
  meta: {
    filepath: ".",
  },
  resources: {
    aws_s3_bucket: {
      "aws_s3_bucket.test-bucket0": {
        id: "aws_s3_bucket.test-bucket0",
        resource_type: "aws_s3_bucket",
        namespace: ".",
        tags: {
          Environment: "Dev",
          Name: "test",
        },
        meta: {
          location: [
            {
              filepath: "secondary.tf",
              line: 1,
              column: 1,
            },
          ],
        },
        attributes: {},
      },
    },
  }
}

export const ruleResultsPassedResultsB = {
  id: "SNYK-CC-00023",
  title: "S3 bucket versioning is disabled",
  platform: [
    "aws",
  ],
  description: "description",
  category: "general",
  labels: [
    "storage",
  ],
  service_group: "S3",
  resource_types: [
    "aws_s3_bucket",
  ],
  results: [{
    passed: true,
    ignored: false,
    resource_id: "aws_s3_bucket.test-bucket0",
    resource_namespace: ".",
    resource_type: "aws_s3_bucket",
    remediation: "remedy",
    severity: RuleResult.SeverityEnum.Medium,
    resources: [
      {
        id: "aws_s3_bucket.test-bucket0",
        type: "aws_s3_bucket",
        namespace: ".",
        location: [
          {
            filepath: "secondary.tf",
            line: 1,
            column: 1,
          },
        ],
        attributes: [
          {
            path: [
              "versioning",
            ],
            location: {
              filepath: "secondary.tf",
              line: 1,
              column: 1,
            },
          },
        ],
      },
    ],
  }]
}

export const createFixture = (inputData: { vulnerabilities: Vulnerability[], results: Result[] }): SnykIacTestOutput => ({
  results: {
    resources: [
      {
        id: "aws_s3_bucket.test-bucket0",
        type: "aws_s3_bucket",
        kind: IacProjectType.TERRAFORM,
        file: "main.tf",
        line: 1,
        column: 1,
      },
      {
        id: "aws_s3_bucket.test-bucket0",
        type: "aws_s3_bucket",
        kind: IacProjectType.TERRAFORM,
        file: "secondary.tf",
        line: 1,
        column: 1,
      }
    ],
    vulnerabilities: inputData.vulnerabilities,
    metadata: {
      projectName: "sergiu-snyk/s3-bucket",
      ignoredCount: 0,
    },
    scanAnalytics: {}
  },
  rawResults: {
    format: Results.FormatEnum.Results,
    format_version: Results.FormatVersionEnum._100,
    results: inputData.results,
  },
  settings: {
    org: "sergiu-iac-plus",
    ignoreSettings: {
      adminOnly: false,
      disregardFilesystemIgnores: false,
      reasonRequired: false,
    },
  },
})

