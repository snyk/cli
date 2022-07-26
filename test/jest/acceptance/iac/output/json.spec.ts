import * as fs from 'fs';

import { FakeServer } from '../../../../acceptance/fake-server';
import { isValidJSONString, startMockServer } from '../helpers';

jest.setTimeout(1_000 * 30);

describe('iac test text output', () => {
  let server: FakeServer;
  let run: (
    cmd: string,
    overrides?: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => Promise<unknown>;

  beforeAll(async () => {
    ({ server, run, teardown } = await startMockServer());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await teardown();
  });

  describe(`with the --json flag`, () => {
    describe('with a single file', () => {
      const jsonOutputForFile = JSON.parse(fs.readFileSync('../../../../fixtures/iac/test-output/json-output-for-file.json', 'utf-8'))
      it('should output the expected results', async () => {
        // Arrange
        const filePath = 'iac/cloudformation/aurora-valid.yml'
  
        // Act
        const { stdout } = await run(`snyk iac test --json ${filePath}`)
        const outputJson = JSON.parse(stdout);
  
        // Assert
        expect(outputJson).toStrictEqual(jsonOutputForFile)
      })
    })

    describe('with multiple files', () => {
        const jsonOutputForFile = JSON.parse(fs.readFileSync('../../../../fixtures/iac/test-output/json-output-for-dir.json', 'utf-8'))

        it('should output the expected results', async () => {
            // Arrange
            const dirPath = 'iac/cloudformation'

            // Act
            const { stdout } = await run(`snyk iac test --json ${dirPath}`)
            const outputJson = JSON.parse(stdout);

            // Assert
            expect(outputJson).toStrictEqual(jsonOutputForFile)
        })
        })
    })
});