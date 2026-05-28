import * as http from 'http';
import { AddressInfo } from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';

import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(120 * 1000);

type OllamaMessage = {
  role: string;
  content?: string;
  tool_calls?: Array<{ function: { name: string; arguments: unknown } }>;
};

type OllamaRequestBody = {
  model: string;
  messages: OllamaMessage[];
  tools?: unknown[];
};

type OllamaResponseBody = {
  model: string;
  message: OllamaMessage;
  done: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
};

type OllamaRequest = { url: string | undefined; body: OllamaRequestBody };
type OllamaBehavior = (req: OllamaRequestBody) => OllamaResponseBody;

const ADVISORY_MARKER =
  '<!-- remy:advisory risk=high reason="mocked advisory for e2e test" -->';

function advisoryBehavior(): OllamaBehavior {
  return (req) => ({
    model: req.model,
    message: {
      role: 'assistant',
      content: `I cannot auto-apply this upgrade safely.\n\n${ADVISORY_MARKER}`,
    },
    done: true,
    done_reason: 'stop',
    prompt_eval_count: 100,
    eval_count: 25,
  });
}

// applyBehavior drives the agent through one full apply turn:
//   1. write_file(package.json) — uses the supplied newPackageJsonContent
//   2. run_command(npm install) — refreshes node_modules + lockfile
//   3. final summary (no tool_calls), terminating the agent loop
//
// Dispatch is by inspection of the assistant tool-calls already in the
// message history rather than a turn counter, so the test is resilient
// to an extra exploratory call (e.g. read_file) if the prompt evolves.
function applyBehavior(newPackageJsonContent: string): OllamaBehavior {
  return (req) => {
    const seen = new Set<string>();
    for (const m of req.messages) {
      if (m.role === 'assistant' && m.tool_calls) {
        for (const tc of m.tool_calls) {
          seen.add(tc.function.name);
        }
      }
    }

    if (!seen.has('write_file')) {
      return {
        model: req.model,
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'write_file',
                arguments: {
                  path: 'package.json',
                  content: newPackageJsonContent,
                },
              },
            },
          ],
        },
        done: true,
        done_reason: 'stop',
      };
    }

    if (!seen.has('run_command')) {
      return {
        model: req.model,
        message: {
          role: 'assistant',
          content: '',
          tool_calls: [
            {
              function: {
                name: 'run_command',
                arguments: { cmd: 'npm', args: ['install'] },
              },
            },
          ],
        },
        done: true,
        done_reason: 'stop',
      };
    }

    return {
      model: req.model,
      message: {
        role: 'assistant',
        content:
          '## Snyk Vulnerability Patch Summary\n\n' +
          '### Validation\n' +
          '| Check | Result |\n|---|---|\n' +
          '| Snyk Re-scan | ✅ Resolved |\n' +
          '| Build | ✅ Pass |\n' +
          '| Tests | ✅ Pass |\n',
      },
      done: true,
      done_reason: 'stop',
    };
  };
}

function startOllamaMock(): Promise<{
  server: http.Server;
  port: number;
  requests: OllamaRequest[];
  setBehavior: (b: OllamaBehavior) => void;
}> {
  const requests: OllamaRequest[] = [];
  let behavior: OllamaBehavior = advisoryBehavior();
  const setBehavior = (b: OllamaBehavior) => {
    behavior = b;
  };

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (req.url !== '/api/chat') {
        res.statusCode = 404;
        res.end();
        return;
      }
      let body: OllamaRequestBody;
      try {
        body = JSON.parse(raw) as OllamaRequestBody;
      } catch (e) {
        res.statusCode = 400;
        res.end('bad json');
        return;
      }
      requests.push({ url: req.url, body });

      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(behavior(body)));
    });
  });

  return new Promise((resolve) => {
    server.listen(0, () => {
      const addr = server.address() as AddressInfo;
      resolve({ server, port: addr.port, requests, setBehavior });
    });
  });
}

function hashTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') {
        continue;
      }
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile()) {
        const buf = fs.readFileSync(full);
        const rel = path.relative(root, full);
        out[rel] = createHash('sha256').update(buf).digest('hex');
      }
    }
  };
  walk(root);
  return out;
}

const UPGRADED_PACKAGE_JSON = JSON.stringify(
  {
    name: 'remy-test-project',
    version: '1.0.0',
    description:
      'Throwaway project for exercising `snyk remy --auto-approve`. Pinned to a known-vulnerable minimist version.',
    private: true,
    main: 'index.js',
    scripts: {
      start: 'node index.js',
      test: "node -e \"require('./index.js'); console.log('ok')\"",
    },
    dependencies: {
      minimist: '1.2.6',
    },
  },
  null,
  2,
);

describe('`snyk remy` with mocked ollama', () => {
  let ollamaServer: http.Server;
  let ollamaPort: number;
  let ollamaRequests: OllamaRequest[];
  let setBehavior: (b: OllamaBehavior) => void;
  let env: Record<string, string>;

  beforeAll(async () => {
    const ollama = await startOllamaMock();
    ollamaServer = ollama.server;
    ollamaPort = ollama.port;
    ollamaRequests = ollama.requests;
    setBehavior = ollama.setBehavior;
    env = {
      ...process.env,
      OLLAMA_HOST: 'http://localhost:' + ollamaPort,
    };
  });

  afterEach(() => {
    ollamaRequests.length = 0;
    setBehavior(advisoryBehavior());
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => ollamaServer.close(() => resolve()));
  });

  it('drives a write_file + npm install round trip and patches package.json', async () => {
    setBehavior(applyBehavior(UPGRADED_PACKAGE_JSON));

    const project = await createProjectFromWorkspace('remy-vulnerable-npm');
    const before = hashTree(project.path());
    const beforePkg = JSON.parse(
      await fs.promises.readFile(
        path.join(project.path(), 'package.json'),
        'utf8',
      ),
    );
    expect(beforePkg.dependencies.minimist).toBe('1.2.0');

    const result = await runSnykCLI(
      [
        'fix',
        '--agentic',
        '--experimental',
        '--provider',
        'ollama',
        '--model',
        'llama3',
        '--auto-approve',
        '--no-breakability',
        project.path(),
      ].join(' '),
      { env },
    );
    if (result.code !== 0) {
      // eslint-disable-next-line no-console
      console.log('REMY STDOUT:\n', result.stdout);
      // eslint-disable-next-line no-console
      console.log('REMY STDERR:\n', result.stderr);
    }
    expect(result.code).toBe(0);

    // The mock got at least two turns: one returning write_file,
    // one returning run_command. The third turn returns the summary.
    const calledTools = new Set<string>();
    for (const req of ollamaRequests) {
      for (const m of req.body.messages) {
        if (m.role === 'assistant' && m.tool_calls) {
          for (const tc of m.tool_calls) {
            calledTools.add(tc.function.name);
          }
        }
      }
    }
    expect(calledTools).toContain('write_file');
    expect(calledTools).toContain('run_command');

    // The agent dispatched write_file → package.json hash changed,
    // and the file now contains the upgraded minimist version.
    const after = hashTree(project.path());
    expect(after).not.toEqual(before);
    const afterPkg = JSON.parse(
      await fs.promises.readFile(
        path.join(project.path(), 'package.json'),
        'utf8',
      ),
    );
    expect(afterPkg.dependencies.minimist).toBe('1.2.6');
  });

  it('records an advisory and leaves the project on disk untouched', async () => {
    setBehavior(advisoryBehavior());

    const project = await createProjectFromWorkspace('remy-vulnerable-npm');
    const before = hashTree(project.path());

    const result = await runSnykCLI(
      [
        'fix',
        '--agentic',
        '--experimental',
        '--provider',
        'ollama',
        '--model',
        'llama3',
        '--auto-approve',
        '--no-breakability',
        project.path(),
      ].join(' '),
      { env },
    );
    if (result.code !== 0) {
      // eslint-disable-next-line no-console
      console.log('REMY STDOUT:\n', result.stdout);
      // eslint-disable-next-line no-console
      console.log('REMY STDERR:\n', result.stderr);
    }
    expect(result.code).toBe(0);

    expect(result.stdout).toContain('Mode:     auto-approve');
    expect(result.stdout).toContain('Provider: ollama');
    expect(ollamaRequests.length).toBeGreaterThan(0);
    expect(ollamaRequests[0].body.model).toBe('llama3');
    expect(result.stdout.toLowerCase()).toMatch(/advisory|skipped/);

    const after = hashTree(project.path());
    expect(after).toEqual(before);
  });

  it('without --experimental, gates the workflow and never calls ollama', async () => {
    const project = await createProjectFromWorkspace('remy-vulnerable-npm');
    const before = hashTree(project.path());

    const { stdout } = await runSnykCLI(
      [
        'fix',
        '--agentic',
        '--provider',
        'ollama',
        '--model',
        'llama3',
        '--auto-approve',
        project.path(),
      ].join(' '),
      { env },
    );

    expect(stdout.toLowerCase()).toContain('experimental');
    expect(ollamaRequests.length).toBe(0);

    const after = hashTree(project.path());
    expect(after).toEqual(before);
  });
});
