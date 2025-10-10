import {
  createProjectFromFixture,
  createProjectFromWorkspace,
} from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60);

describe('print graph', () => {
  test("`snyk test --print-graph` should print a project's dep-graph", async () => {
    const project = await createProjectFromWorkspace('npm-package');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    expect(stdout).toMatch('DepGraph data:');
    expect(stdout).toMatch('DepGraph target:\npackage-lock.json');
  });

  test('`snyk test --print-graph` should not prune maven dependencies', async () => {
    const project = await createProjectFromWorkspace('maven-many-paths');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);
    const depGraph = JSON.parse(
      stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
    );
    let numEdges = 0;
    for (const node of depGraph.graph.nodes) {
      numEdges += node.deps.length;
    }
    expect(numEdges).toEqual(7);
  });

  if (!isWindowsOperatingSystem()) {
    // Address as part CLI-1219
    test('`snyk test --print-graph` should not prune gradle dependencies', async () => {
      const project = await createProjectFromFixture(
        'gradle-with-repeated-deps',
      );

      const { code, stdout } = await runSnykCLI('test --print-graph', {
        cwd: project.path(),
      });

      expect(code).toEqual(0);
      const depGraph = JSON.parse(
        stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
      );
      let numEdges = 0;
      for (const node of depGraph.graph.nodes) {
        numEdges += node.deps.length;
      }
      expect(numEdges).toEqual(28);
    });
  }

  test('`snyk test --print-graph` resolves Maven metaversions', async () => {
    const project = await createProjectFromFixture('maven-metaversion');

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
    });

    expect(code).toEqual(0);

    const depGraph = JSON.parse(
      stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
    );

    // Ensure no LATEST/RELEASE metaversions remain in any package id
    for (const pkg of depGraph.pkgs) {
      expect(pkg.id).not.toMatch(/@(LATEST|RELEASE)$/);
      expect(pkg.info.version).not.toMatch(/^(LATEST|RELEASE)$/);
    }

    // Minimum packages: at least the root + two metaversion deps
    expect(depGraph.pkgs.length).toBeGreaterThanOrEqual(3);
  });

  test('`snyk test --print-graph --include-provenance` includes purl in package info for Maven projects', async () => {
    // Note: --include-provenance triggers purl generation for Maven artifacts.
    // If artifacts are present in the local Maven repository, checksums would be
    // included in the purl (e.g., pkg:maven/group/artifact@version?checksum=sha256:...).
    // This test verifies purl generation without requiring artifacts to be installed,
    // so we only check for the presence of purls, not checksum qualifiers.
    const project = await createProjectFromFixture('maven-print-graph');

    const { code, stdout } = await runSnykCLI(
      'test --print-graph --include-provenance',
      {
        cwd: project.path(),
      },
    );

    expect(code).toEqual(0);

    const depGraph = JSON.parse(
      stdout.split('DepGraph data:')[1]?.split('DepGraph target:')[0],
    );

    // Verify all packages have a purl
    for (const pkg of depGraph.pkgs) {
      expect(pkg.info.purl).toBeDefined();
      expect(pkg.info.purl).toMatch(/^pkg:maven\//);
    }

    // Find packages with known dependencies from maven-print-graph fixture
    const axisPackage = depGraph.pkgs.find((pkg) => pkg.id === 'axis:axis@1.4');

    // Verify axis package has purl -- using toMatch in case dependency _has_ been
    // resolved by some other fixture.
    expect(axisPackage).toBeDefined();
    expect(axisPackage.info.purl).toMatch(/^pkg:maven\/axis\/axis@1\.4/);
  });

  test('`snyk test --print-graph --all-projects` should not prune dependencies', async () => {
    const project = await createProjectFromWorkspace('maven-many-paths');

    const { code, stdout } = await runSnykCLI(
      'test --print-graph --all-projects',
      {
        cwd: project.path(),
      },
    );

    expect(code).toEqual(0);
    const depGraphs = stdout
      .split('DepGraph data:')
      .filter(Boolean)
      .map((s) => JSON.parse(s.split('DepGraph target:')[0]));

    let numEdges = 0;
    for (const depGraph of depGraphs) {
      for (const node of depGraph.graph.nodes) {
        numEdges += node.deps.length;
      }
    }
    expect(numEdges).toEqual(14);
  });
});
