import * as fs from 'fs-extra';
import * as os from 'os';
import * as path from 'path';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';
import { runCommand } from '../../util/runCommand';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(120000);

const languages = [
  ['csproj', 'Microsoft.CSharp.targets'],
  ['vbproj', 'Microsoft.VisualBasic.targets'],
  ['fsproj', 'FSharp/Microsoft.FSharp.Targets'],
];
const org = '55555555-5555-5555-5555-555555555555';

function classicProject(targets: string, packageReference = ''): string {
  return `<Project ToolsVersion="Current" xmlns="http://schemas.microsoft.com/developer/msbuild/2003">
  <Import Project="$(MSBuildExtensionsPath)/$(MSBuildToolsVersion)/Microsoft.Common.props" />
  <PropertyGroup><OutputType>Library</OutputType><TargetFrameworkVersion>v4.8</TargetFrameworkVersion></PropertyGroup>
  <ItemGroup><Reference Include="System" />${packageReference}</ItemGroup>
  <Import Project="$(MSBuildBinPath)/${targets}" />
</Project>`;
}

function uploadedGraphs(server: FakeServer) {
  return server
    .getRequests()
    .filter((request) => request.path.endsWith('/files'))
    .flatMap((request) => {
      const boundary =
        request.headers['content-type']?.match(/boundary="?([^";]+)/)?.[1];
      if (!boundary)
        throw new Error('Upload is missing its multipart boundary');
      const body = request.body;
      if (!Buffer.isBuffer(body))
        throw new Error('Upload body must be a Buffer');
      return body
        .toString('utf8')
        .split(`--${boundary}`)
        .filter((part: string) => part.includes('Content-Disposition:'))
        .map((part: string) =>
          JSON.parse(part.slice(part.indexOf('\r\n\r\n') + 4).trim()),
        );
    });
}

describe.each([false, true])(
  'Dragonfly .NET projects (native resolver: %s)',
  (native) => {
    let server: FakeServer;
    let directory: string;
    let env: NodeJS.ProcessEnv;

    beforeAll(async () => {
      if (!process.env.TEST_SNYK_COMMAND)
        throw new Error('TEST_SNYK_COMMAND must point to the built Go CLI');
      const dotnet = await runCommand('dotnet', ['--version']);
      if (dotnet.code !== 0)
        throw new Error(`dotnet is required: ${dotnet.stderr}`);
      server = fakeServer('/v1', '123456789');
      await server.listenPromise(0);
    });

    beforeEach(async () => {
      directory = await fs.realpath(
        await fs.mkdtemp(path.join(os.tmpdir(), 'snyk-dotnet-empty-')),
      );
      server.restore();
      server.setFeatureFlag('rollout-dfly-os-cli', true);
      server.setFeatureFlag('internal-dotnet-resolver', native);
      env = {
        ...process.env,
        SNYK_API: `http://localhost:${server.getPort()}/v1`,
        SNYK_TOKEN: '123456789',
        SNYK_PREVIEW: '0',
        SNYK_CFG_ORG: org,
        // Fake credentials keep stored OAuth audiences from overriding the local API.
        INTERNAL_OAUTH_TOKEN_STORAGE: JSON.stringify({
          access_token: 'validation-token',
          token_type: 'Bearer',
          expiry: '2100-01-01T00:00:00Z',
        }),
        SNYK_DISABLE_ANALYTICS: '1',
        SNYK_HTTP_PROTOCOL_UPGRADE: '0',
        XDG_CONFIG_HOME: directory,
      };
    });

    afterEach(async () => {
      await fs.remove(directory);
    });

    afterAll(async () => {
      await server?.closePromise();
    });

    async function scan() {
      return runSnykCLI(
        'test --all-projects --remote-repo-url=https://example.invalid/empty-project --json',
        { cwd: directory, env },
      );
    }

    function expectEmptyUpload(targetFile: string) {
      const graphs = uploadedGraphs(server);
      expect(graphs).toHaveLength(1);
      expect(graphs[0].depGraph.pkgManager.name).toBe('nuget');
      expect(graphs[0].depGraph.pkgs).toHaveLength(1);
      expect(graphs[0].depGraph.graph.nodes).toHaveLength(1);
      expect(graphs[0].depGraph.graph.nodes[0].deps).toEqual([]);
      expect(graphs[0].identity).toMatchObject({
        type: 'nuget',
        targetFile,
        targetRuntime: 'net48',
      });
      expect(
        server
          .getRequests()
          .some(
            (request) =>
              request.method === 'POST' &&
              request.path === `/rest/orgs/${org}/tests`,
          ),
      ).toBe(true);
    }

    test.each(languages)(
      'uploads a verified empty %s without restoring',
      async (extension, targets) => {
        await fs.writeFile(
          path.join(directory, `Example.${extension}`),
          classicProject(targets),
        );

        const result = await scan();

        expect(result.code).toBe(0);
        expectEmptyUpload(path.join('obj', 'project.assets.json'));
        expect(
          await fs.pathExists(path.join(directory, 'obj/project.assets.json')),
        ).toBe(false);
      },
    );

    test('refuses an unrestored project with a PackageReference', async () => {
      await fs.writeFile(
        path.join(directory, 'Example.csproj'),
        classicProject(
          'Microsoft.CSharp.targets',
          '<PackageReference Include="Polly" Version="8.6.5" />',
        ),
      );

      const result = await scan();

      expect(result.code).toBe(2);
      expect(result.stdout).toContain('require restored NuGet metadata');
      expect(uploadedGraphs(server)).toHaveLength(0);
      expect(
        server
          .getRequests()
          .some(
            (request) =>
              request.method === 'POST' &&
              request.path === `/rest/orgs/${org}/tests`,
          ),
      ).toBe(false);
      expect(
        await fs.pathExists(path.join(directory, 'obj/project.assets.json')),
      ).toBe(false);
    });

    test.each([
      {
        name: 'aligned backslashes',
        output: ['obj', 'custom', 'project.assets.json'],
        beforeImport: String.raw`<PropertyGroup><ProjectAssetsFile>obj\custom\project.assets.json</ProjectAssetsFile><MSBuildProjectExtensionsPath>obj\custom\</MSBuildProjectExtensionsPath></PropertyGroup>`,
        afterImport: '',
        accepted: true,
      },
      {
        name: 'target-time restore redirect',
        output: ['custom', 'project.assets.json'],
        beforeImport: '',
        afterImport:
          '<Target Name="SetRestoreOutput" BeforeTargets="_GenerateRestoreProjectSpec"><PropertyGroup><RestoreOutputPath>custom</RestoreOutputPath></PropertyGroup></Target>',
        accepted: false,
      },
    ])(
      'checks restore identity with $name',
      async ({ beforeImport, afterImport, accepted, output }) => {
        const project = classicProject('Microsoft.CSharp.targets')
          .replace('  <Import', `${beforeImport}\n  <Import`)
          .replace('</Project>', `${afterImport}\n</Project>`);
        await fs.writeFile(path.join(directory, 'Example.csproj'), project);

        const result = await scan();

        expect(result.code).toBe(accepted ? 0 : 2);
        expect(uploadedGraphs(server)).toHaveLength(accepted ? 1 : 0);
        expect(result.stdout).toContain(
          accepted ? '"ok": true' : 'unique legacy NuGet monitor identity',
        );
        if (accepted) {
          expectEmptyUpload(path.join('obj', 'custom', 'project.assets.json'));
        }
        expect(await fs.pathExists(path.join(directory, ...output))).toBe(
          false,
        );
        expect(
          await fs.pathExists(
            path.join(directory, 'obj', 'project.assets.json'),
          ),
        ).toBe(false);
      },
    );

    test('uploads a genuinely restored empty project', async () => {
      await fs.writeFile(
        path.join(directory, 'Example.csproj'),
        classicProject('Microsoft.CSharp.targets'),
      );
      await fs.writeFile(
        path.join(directory, 'NuGet.Config'),
        '<configuration><packageSources><clear /></packageSources></configuration>',
      );
      const restore = await runCommand(
        'dotnet',
        [
          'restore',
          'Example.csproj',
          '-p:RestoreProjectStyle=PackageReference',
          '--configfile',
          'NuGet.Config',
        ],
        { cwd: directory, env },
      );
      expect(restore.code).toBe(0);
      expect(
        (await fs.readJSON(path.join(directory, 'obj/project.assets.json')))
          .libraries,
      ).toEqual({});

      const result = await scan();

      expect(result.code).toBe(0);
      expectEmptyUpload(
        native ? 'Example.csproj' : path.join('obj', 'project.assets.json'),
      );
    });
  },
);
