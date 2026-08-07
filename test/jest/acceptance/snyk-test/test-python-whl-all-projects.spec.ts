import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import {
  fakeServer,
  getFirstIPv4Address,
} from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';
import { getServerPort } from '../../util/getServerPort';
import * as path from 'path';

jest.setTimeout(1000 * 60 * 5);

describe('`snyk test --all-projects` with .whl file references in requirements.txt', () => {
  let server;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = getServerPort(process);
    const baseApi = '/api/v1';
    const ipAddress = getFirstIPv4Address();
    env = {
      ...process.env,
      SNYK_API: `http://${ipAddress}:${port}${baseApi}`,
      SNYK_HOST: `http://${ipAddress}:${port}`,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it('should successfully scan projects with .whl files when using --all-projects', async () => {
    const project = await createProjectFromWorkspace(
      'pip-app-whl-all-projects',
    );

    // Install packages in each project subdirectory
    const projects = ['project-a', 'project-b'];

    let pythonCommand = 'python';
    await runCommand(pythonCommand, ['--version']).catch(() => {
      pythonCommand = 'python3';
    });

    const pythonPaths: string[] = [];

    for (const projectDir of projects) {
      const projectPath = project.path(projectDir);
      const sitePackagesPath = path.join(projectPath, 'site-packages');

      await runCommand(
        pythonCommand,
        [
          '-m',
          'pip',
          'install',
          '-r',
          'requirements.txt',
          '--target',
          'site-packages',
        ],
        {
          cwd: projectPath,
          env,
        },
      ).catch(() => {
        // Ignore installation errors - test focuses on parsing behavior
      });

      pythonPaths.push(sitePackagesPath);
    }

    // Set PYTHONPATH to include all site-packages directories (Windows only)
    const testEnv = {
      ...env,
    };

    if (process.platform === 'win32') {
      testEnv.PYTHONPATH = pythonPaths.join(';');
    }

    // Run snyk test with --all-projects using JSON output
    const { stdout, stderr } = await runSnykCLI(
      `test --all-projects --json --command=${pythonCommand}`,
      {
        cwd: project.path(),
        env: testEnv,
      },
    );

    // With the fix, .whl files should be parsed correctly
    // No "Unparsable requirement line" errors (this was the bug)
    expect(stderr).not.toContain('Unparsable requirement line');
    expect(stderr).not.toContain(
      'Expected package name at the start of dependency specifier',
    );

    // Parse JSON output
    const parsed = JSON.parse(stdout);
    const results = Array.isArray(parsed) ? parsed : [parsed];

    // Extract project identifiers from displayTargetFile (e.g., "project-a/requirements.txt")
    const projectIdentifiers = results
      .map((r) => {
        const targetFile = r.displayTargetFile || r.targetFile || '';
        // Extract "project-a" or "project-b" from paths like "project-a/requirements.txt"
        const match = targetFile.match(/(project-[ab])/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    // Should successfully test both projects
    expect(projectIdentifiers).toContain('project-a');
    expect(projectIdentifiers).toContain('project-b');
  });

  it('should succeed when scanning individual projects (not using --all-projects)', async () => {
    const project = await createProjectFromWorkspace(
      'pip-app-whl-all-projects',
    );

    let pythonCommand = 'python';
    await runCommand(pythonCommand, ['--version']).catch(() => {
      pythonCommand = 'python3';
    });

    const projectPath = project.path('project-a');
    const sitePackagesPath = path.join(projectPath, 'site-packages');

    // Install packages into project's local directory using --target
    await runCommand(
      pythonCommand,
      [
        '-m',
        'pip',
        'install',
        '-r',
        'requirements.txt',
        '--target',
        'site-packages',
      ],
      {
        cwd: projectPath,
        env,
      },
    ).catch(() => {
      // Ignore installation errors - test focuses on parsing behavior
    });

    // Set PYTHONPATH to include site-packages directory (Windows only)
    const testEnv = {
      ...env,
    };

    if (process.platform === 'win32') {
      testEnv.PYTHONPATH = sitePackagesPath;
    }

    // Run snyk test on individual project using JSON output
    const { stderr } = await runSnykCLI(
      `test --json --command=${pythonCommand}`,
      {
        cwd: projectPath,
        env: testEnv,
      },
    );

    // Individual scanning should work correctly with .whl files
    // No parse errors should occur
    expect(stderr).not.toContain('Unparsable requirement line');
  });
});
