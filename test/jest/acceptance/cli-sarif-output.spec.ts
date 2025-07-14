import { join } from 'path';
import { runSnykCLI } from '../util/runSnykCLI';
import Ajv from 'ajv-draft-04';
jest.setTimeout(1000 * 60);

async function loadSchema(uri: string) {
  try {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch schema from ${uri}: ${response.statusText}`,
      );
    }
    return response.json();
  } catch (error) {
    throw new Error(`Failed to load schema from ${uri}: ${error.message}`);
  }
}

const SARIF_SCHEMA_URL =
  'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json';
const SARIF_VERSION = '2.1.0';

type TestCase = {
  name: string;
  target: string;
  cmd: string;
  env: NodeJS.ProcessEnv;
};

const TEST_CASES: Array<TestCase> = [
  {
    name: 'Snyk Open Source',
    cmd: 'test --sarif',
    target: join(__dirname, '../../fixtures/npm/with-vulnerable-lodash-dep'),
    env: { ...process.env },
  },
  {
    name: 'Snyk Code (native)',
    cmd: 'code test --sarif',
    target: join(__dirname, '../../fixtures/sast/with_code_issues'),
    env: {
      ...process.env,

      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'true',
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'true',
    },
  },
  {
    name: 'Snyk Code (legacy)',
    cmd: 'code test --sarif',
    target: join(__dirname, '../../fixtures/sast/with_code_issues'),
    env: {
      ...process.env,
      INTERNAL_SNYK_CODE_IGNORES_ENABLED: 'false',
      INTERNAL_SNYK_CODE_NATIVE_IMPLEMENTATION: 'false',
    },
  },
  {
    name: 'Snyk Container',
    cmd: 'container test --sarif',
    target:
      'docker-archive:test/fixtures/container-projects/multi-project-image.tar',
    env: { ...process.env },
  },
  {
    name: 'Snyk IaC',
    cmd: 'iac test --sarif',
    target: join(
      __dirname,
      '../../acceptance/workspaces/iac-kubernetes/multi-file.yaml',
    ),
    env: { ...process.env },
  },
];

describe('SARIF output is schema compliant', () => {
  it.each(TEST_CASES)('for $name', async ({ cmd, env, target }: TestCase) => {
    const { stdout, code } = await runSnykCLI(`${cmd} ${target}`, { env });
    expect(code).toBe(1);

    const result = JSON.parse(stdout);
    expect(result.$schema).toEqual(SARIF_SCHEMA_URL);
    expect(result.version).toEqual(SARIF_VERSION);
    expect(result.runs.length).toBeGreaterThan(0);
    expect(result.runs[0].results.length).toBeGreaterThan(0);

    const schema = await loadSchema(result.$schema);
    const jsonValidator = new Ajv({ validateFormats: false });
    expect(jsonValidator.validate(schema, result)).toBe(true);
  });
});
