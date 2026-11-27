import {
  DEFAULT_DOCKER_MAX_VULN_PATHS,
  setDefaultTestOptions,
} from '../../../../../../src/cli/commands/test/set-default-test-options';
import { convertTestDepGraphResultToLegacy } from '../../../../../../src/lib/snyk-test/legacy';
import { DepGraphBuilder } from '@snyk/dep-graph';

describe('setDefaultTestOptions', () => {
  it('default options for language tests leave maxVulnPaths unset', () => {
    const options = {};
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('some');
    expect(result.maxVulnPaths).toBeUndefined();
  });

  it('explicit max-vulnerable-paths', () => {
    const options = { 'max-vulnerable-paths': 42 };
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('some');
    expect(result.maxVulnPaths).toEqual(42);
  });

  it('explicit show-vulnerable-paths', () => {
    const options = { 'show-vulnerable-paths': 'all' };
    const result = setDefaultTestOptions(options as any);
    expect(result.showVulnPaths).toEqual('all');
    expect(result.maxVulnPaths).toBeUndefined();
  });

  it('defaults maxVulnPaths for container tests to match text "some" truncation', () => {
    const result = setDefaultTestOptions({ docker: true } as any);
    expect(result.showVulnPaths).toEqual('some');
    expect(result.maxVulnPaths).toEqual(DEFAULT_DOCKER_MAX_VULN_PATHS);
    expect(result.maxVulnPaths).toEqual(3);
  });

  it('keeps an explicit max-vulnerable-paths on container tests', () => {
    const result = setDefaultTestOptions({
      docker: true,
      'max-vulnerable-paths': 100,
    } as any);
    expect(result.maxVulnPaths).toEqual(100);
  });

  it('drops the container path cap when show-vulnerable-paths=all', () => {
    const result = setDefaultTestOptions({
      docker: true,
      'show-vulnerable-paths': 'all',
      'max-vulnerable-paths': 100,
    } as any);
    expect(result.showVulnPaths).toEqual('all');
    expect(result.maxVulnPaths).toBeUndefined();
  });
});

describe('container JSON path expansion with default maxVulnPaths', () => {
  it('emits at most maxVulnPaths entries per vulnerable package', async () => {
    const builder = new DepGraphBuilder(
      { name: 'nuget' },
      { name: 'fixture', version: '1.0.0' },
    );
    builder.addPkgNode({ name: 'Vulnerable.Lib', version: '1.0.0' }, 'leaf');
    for (let i = 0; i < 10; i++) {
      const midId = `mid-${i}`;
      builder.addPkgNode({ name: `Mid.${i}`, version: '1.0.0' }, midId);
      builder.connectDep(builder.rootNodeId, midId);
      builder.connectDep(midId, 'leaf');
    }
    const depGraph = builder.build();
    expect(
      depGraph.countPathsToRoot({
        name: 'Vulnerable.Lib',
        version: '1.0.0',
      }),
    ).toBe(10);

    const apiResponse = {
      result: {
        issuesData: {
          'SNYK-DOTNET-VULN-1': {
            id: 'SNYK-DOTNET-VULN-1',
            title: 'fixture',
            severity: 'high',
          },
        },
        affectedPkgs: {
          'Vulnerable.Lib@1.0.0': {
            pkg: { name: 'Vulnerable.Lib', version: '1.0.0' },
            issues: {
              'SNYK-DOTNET-VULN-1': {
                issueId: 'SNYK-DOTNET-VULN-1',
                fixInfo: { isPatchable: false },
              },
            },
          },
        },
      },
    } as any;

    const uncapped = await convertTestDepGraphResultToLegacy(
      apiResponse,
      depGraph,
      'nuget',
      {} as any,
    );
    expect(uncapped.vulnerabilities).toHaveLength(10);

    const options = setDefaultTestOptions({ docker: true } as any);
    const capped = await convertTestDepGraphResultToLegacy(
      apiResponse,
      depGraph,
      'nuget',
      options as any,
    );
    expect(capped.vulnerabilities).toHaveLength(DEFAULT_DOCKER_MAX_VULN_PATHS);
    expect(capped.vulnerabilities[0].id).toEqual('SNYK-DOTNET-VULN-1');
  });
});
