import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { runCommand } from '../../util/runCommand';

jest.setTimeout(1000 * 60);

// `--include-component-metadata` makes the python plugin forward the flag to
// snyk-poetry-lockfile-parser, which reads the per-package hashes already in
// poetry.lock and surfaces them as `hash:<algorithm>` labels on the dep-graph
// nodes. Like npm (and unlike maven) there is nothing to resolve first — the
// hashes live in the lockfile — so this fixture needs no `poetry install`.
//
// Note the difference from npm: poetry.lock records no artifact *download* URL,
// so `distribution:url` here is the PEP 503 project page for the package with a
// `#<filename>` fragment naming the file whose hash is reported — provenance
// rather than a fetch target. For PyPI-sourced deps (no `[package.source]`) that
// root is pypi.org; private-index (`legacy`) deps use their recorded root.
describe('`snyk test --include-component-metadata` (poetry)', () => {
  interface PrintedGraph {
    target: string;
    graph: any;
  }

  const parseDepGraphs = (printGraphStdout: string): PrintedGraph[] =>
    printGraphStdout
      .split('DepGraph end')
      .filter((block) => block.includes('DepGraph data:'))
      .map((block) => ({
        graph: JSON.parse(
          block.split('DepGraph data:')[1].split('DepGraph target:')[0],
        ),
        target: block.split('DepGraph target:')[1].trim(),
      }));

  const labelKeys = (graph: any, prefix: string): string[] =>
    graph.graph.nodes
      .flatMap((node) => Object.keys(node.info?.labels ?? {}))
      .filter((key) => key.startsWith(prefix));

  const labelValues = (graph: any, key: string): string[] =>
    graph.graph.nodes
      .map((node) => node.info?.labels?.[key])
      .filter((value): value is string => Boolean(value));

  const fixture = 'poetry-include-component-metadata';

  // snyk-python-plugin's poetry path calls getMetaData() with `options.command ||
  // 'python'` regardless of this flag, so an executor without an unqualified
  // `python` on PATH (e.g. CI's Alpine images, which install only `python3`)
  // fails the scan outright. Resolve the interpreter the same way the sibling
  // python specs in this directory do and pass it explicitly.
  let pythonCommand = 'python';

  beforeAll(async () => {
    await runCommand(pythonCommand, ['--version']).catch(() => {
      pythonCommand = 'python3';
    });
  });

  it('attaches hash and distribution:url labels with the flag', async () => {
    const project = await createProjectFromFixture(fixture);

    const { code, stdout } = await runSnykCLI(
      `test --include-component-metadata --print-graph --file=poetry.lock --command=${pythonCommand}`,
      { cwd: project.path() },
    );

    expect(code).toEqual(0);
    const graphs = parseDepGraphs(stdout);
    expect(graphs).toHaveLength(1);
    expect(labelKeys(graphs[0].graph, 'hash:').length).toBeGreaterThan(0);

    // The fixture's deps come from PyPI, so each carries a pypi.org project-page
    // URL whose fragment names the artifact the sibling hash describes.
    const urls = labelValues(graphs[0].graph, 'distribution:url');
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/pypi\.org\/simple\/[^/]+\/#.+$/);
    }
  });

  // Control: without the flag the same project must not produce the labels,
  // proving they are driven by `--include-component-metadata`.
  it('does not attach the labels without the flag', async () => {
    const project = await createProjectFromFixture(fixture);

    const { code, stdout } = await runSnykCLI(
      `test --print-graph --file=poetry.lock --command=${pythonCommand}`,
      { cwd: project.path() },
    );

    expect(code).toEqual(0);
    const graphs = parseDepGraphs(stdout);
    expect(graphs).toHaveLength(1);
    expect(labelKeys(graphs[0].graph, 'hash:')).toHaveLength(0);
    expect(labelKeys(graphs[0].graph, 'distribution:url')).toHaveLength(0);
  });

  // Regression test for the credential-leak class covered for maven and go in
  // #7019: a private index can be configured with credentials embedded in its
  // URL, and poetry records that URL verbatim under `[package.source]`. Those
  // credentials must never reach the distribution:url label, which is shipped
  // off-host with the scan results. The fixture's index carries credentials
  // both ways — basic-auth userinfo (`svc-user:s3cr3t@`) and a query-string
  // token (`?token=abc123`) — and both must be stripped (parser >= 1.10.1, via
  // snyk-python-plugin >= 3.3.1).
  //
  // The fixture's index does not exist and is never contacted: poetry.lock
  // already carries the hashes, so the parser builds the label offline.
  it('does not leak private-index credentials into the distribution:url label', async () => {
    const project = await createProjectFromFixture('poetry-creds-source');

    const { code, stdout } = await runSnykCLI(
      `test --include-component-metadata --print-graph --file=poetry.lock --command=${pythonCommand}`,
      { cwd: project.path() },
    );

    expect(code).toEqual(0);
    const graphs = parseDepGraphs(stdout);
    expect(graphs).toHaveLength(1);

    const urls = labelValues(graphs[0].graph, 'distribution:url');
    expect(urls.length).toBeGreaterThan(0);

    // The credentialed index still identifies the artifact's provenance, but
    // stripped of both credential forms, on every emitted label. The private
    // dep resolves to a clean project-page URL with no userinfo and no query.
    expect(
      urls.some((url) =>
        url.startsWith('https://private.invalid/simple/jinja2/#'),
      ),
    ).toBe(true);
    for (const url of urls) {
      expect(url).not.toContain('svc-user');
      expect(url).not.toContain('s3cr3t');
      expect(url).not.toContain('abc123');
      expect(url).not.toContain('token=');
      expect(url).not.toMatch(/:\/\/[^/]*@/); // no userinfo
      expect(url).not.toContain('?'); // no query string
    }
  });
});
