import { createProjectFromWorkspace } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { FakeServer, fakeServer } from '../../../acceptance/fake-server';

jest.setTimeout(1000 * 60 * 5);

describe('golang sboms (mocked server only)', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll((done) => {
    const port = process.env.PORT || process.env.SNYK_PORT || '60213';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  test('Golang SBOMs contain properly formatted PackageURLs', async () => {
    const project = await createProjectFromWorkspace(
      'golang-gomodules-many-deps',
    );

    const { code, stdout } = await runSnykCLI(
      `sbom --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.6+json --debug`,
      {
        cwd: project.path(),
        env,
      },
    );
    let bom: any;

    expect(code).toEqual(0);
    expect(() => {
      bom = JSON.parse(stdout);
    }).not.toThrow();

    expect(bom.components).toHaveLength(12);
    const purls: string[] = bom.components.map(({ purl }: any) => purl);
    expect(purls).toEqual([
      'pkg:golang/app@0.0.0',
      'pkg:golang/k8s.io/utils@v0.0.0-20251002143259-bc988d571ff4#diff',
      'pkg:golang/k8s.io/utils@v0.0.0-20251002143259-bc988d571ff4#field',
      'pkg:golang/github.com/davecgh/go-spew@v1.1.1#spew',
      'pkg:golang/golang.org/x/exp@v0.0.0-20251113190631-e25ba8c21ef6#slog/slogtest',
      'pkg:golang/golang.org/x/exp@v0.0.0-20251113190631-e25ba8c21ef6#slog',
      'pkg:golang/golang.org/x/exp@v0.0.0-20251113190631-e25ba8c21ef6#slog/internal/buffer',
      'pkg:golang/golang.org/x/exp@v0.0.0-20251113190631-e25ba8c21ef6#slog/internal',
      'pkg:golang/golang.org/x/exp@v0.0.0-20251113190631-e25ba8c21ef6#slices',
      'pkg:golang/github.com/hashicorp/go-retryablehttp@v0.7.8',
      'pkg:golang/github.com/hashicorp/go-cleanhttp@v0.5.2',
      'pkg:golang/github.com/gorilla/mux@v1.8.1',
    ]);
  });
});
