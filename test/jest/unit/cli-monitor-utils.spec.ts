import * as utils from '../../../src/lib/monitor/utils';
import { ScannedProject, DepTree } from '@snyk/cli-interface/legacy/common';
import * as fs from 'fs';
import { MonitorMeta } from '../../../src/lib/types';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

function stubScannedProjectContainer() {
  return {
    depTree: {},
    meta: {
      imageName: 'some-image',
    },
    targetFile: '/tmp/package.json',
  };
}

function stubScannedProject() {
  return {
    depTree: {},
  };
}

function getStubDepTree(): DepTree {
  return {
    name: 'my-project',
  };
}

function getStubDepGraph() {
  return JSON.parse(
    fs.readFileSync('./test/fixtures/dep-graph/dep-graph.json').toString(),
  );
}

function getStubMeta(): MonitorMeta {
  return {
    method: 'cli',
    packageManager: 'npm',
    'policy-path': '',
    'project-name': '',
    isDocker: true,
    prune: false,
  };
}

function getOverrideNameStubMeta(): MonitorMeta {
  return {
    method: 'cli',
    packageManager: 'npm',
    'policy-path': '',
    'project-name': 'project-name-override',
    isDocker: true,
    prune: false,
  };
}

function getStubPluginMeta(): PluginMetadata {
  return {
    name: 'my-plugin',
    targetFile: '/tmp2/package.json',
  };
}

describe('cli-monitor-utils test', () => {
  it('getNameDepTree returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getNameDepTree(
      scannedProject,
      getStubDepTree(),
      getStubMeta(),
    );
    expect(res).toEqual('some-image:/tmp/package.json');
  });

  it('getNameDepTree returns name from depTree if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getNameDepTree(
      scannedProject,
      getStubDepTree(),
      getStubMeta(),
    );
    expect(res).toEqual('my-project');
  });

  it('getNameDepGraph returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getNameDepGraph(
      scannedProject,
      getStubDepGraph(),
      getStubMeta(),
    );
    expect(res).toEqual('some-image:/tmp/package.json');
  });

  it('getNameDepGraph returns name from depGraph if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getNameDepGraph(
      scannedProject,
      getStubDepGraph(),
      getStubMeta(),
    );
    expect(res).toEqual('my-project');
  });

  it('getProjectName returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getProjectName(scannedProject, getStubMeta());
    expect(res).toEqual('some-image');
  });

  it('getProjectName returns name from meta if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getProjectName(scannedProject, getOverrideNameStubMeta());
    expect(res).toEqual('project-name-override');
  });

  it('getTargetFile returns name from scanned project if container', () => {
    const scannedProject: ScannedProject = stubScannedProjectContainer();
    const res = utils.getTargetFile(scannedProject, getStubPluginMeta());
    expect(res).toEqual('/tmp/package.json');
  });

  it('getTargetFile returns name from plugin meta if not container', () => {
    const scannedProject: ScannedProject = stubScannedProject();
    const res = utils.getTargetFile(scannedProject, getStubPluginMeta());
    expect(res).toEqual('/tmp2/package.json');
  });
});
