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

  it('getProjectName returns nuget project name from scanned project meta when --assets-project-name is provided via options', () => {
    const scannedProject: ScannedProject = {
      depTree: {
        dependencies: {
          'Microsoft.Extensions.FileProviders.Embedded': {
            name: 'Microsoft.Extensions.FileProviders.Embedded',
            version: '6.0.22',
          },
        },
        name: 'nuget-project-assets-name',
        packageFormatVersion: 'nuget:0.0.0',
        version: '0.0.1',
        targetFile: 'project.assets.json',
      },
      targetFile: 'project.assets.json',
    };

    const res = utils.getProjectName(scannedProject, {
      method: 'cli',
      packageManager: 'nuget',
      'policy-path': '',
      'project-name': '',
      isDocker: false,
      prune: false,
      assetsProjectName: true,
    });
    expect(res).toEqual('nuget-project-assets-name');
  });

  it('getProjectName overrides --assets-project-name with value from --project-name flag', () => {
    const scannedProject: ScannedProject = {
      depTree: {
        dependencies: {
          'Microsoft.Extensions.FileProviders.Embedded': {
            name: 'Microsoft.Extensions.FileProviders.Embedded',
            version: '6.0.22',
          },
        },
        name: 'nuget-project-assets-name',
        packageFormatVersion: 'nuget:0.0.0',
        version: '0.0.1',
        targetFile: 'project.assets.json',
      },
      targetFile: 'project.assets.json',
    };

    const res = utils.getProjectName(scannedProject, {
      method: 'cli',
      packageManager: 'nuget',
      'policy-path': '',
      'project-name': 'project-name-from-option',
      isDocker: false,
      prune: false,
      assetsProjectName: true,
    });
    expect(res).toEqual('project-name-from-option');
  });

  it('getProjectName returns gradle project name from scanned project meta', () => {
    const scannedProject: ScannedProject = {
      depGraph: {} as any,
      meta: {
        gradleProjectName: 'my-gradle-project',
      },
      targetFile: '/tmp/build.gradle',
    };

    const res = utils.getProjectName(scannedProject, {
      method: 'cli',
      packageManager: 'gradle',
      'policy-path': '',
      'project-name': '',
      isDocker: false,
      prune: false,
    });
    expect(res).toEqual('my-gradle-project');
  });

  it('getProjectName returns project name from scanned project meta when project-name is provided via option', () => {
    const scannedProject: ScannedProject = {
      depGraph: {} as any,
      meta: {
        gradleProjectName: 'my-gradle-project',
        projectName: 'meta-gradle-project',
      },
      targetFile: '/tmp/build.gradle',
    };

    const res = utils.getProjectName(scannedProject, {
      method: 'cli',
      packageManager: 'gradle',
      'policy-path': '',
      'project-name': 'project-name-from-option',
      isDocker: false,
      prune: false,
    });
    expect(res).toEqual('meta-gradle-project');
  });

  it('getProjectName returns project name when project-name is provided via option', () => {
    const scannedProject: ScannedProject = {
      depGraph: {} as any,
      meta: { gradleProjectName: 'my-gradle-project' },
      targetFile: '/tmp/build.gradle',
    };

    const res = utils.getProjectName(scannedProject, {
      method: 'cli',
      packageManager: 'gradle',
      'policy-path': '',
      'project-name': 'project-name-from-option',
      isDocker: false,
      prune: false,
    });
    expect(res).toEqual('project-name-from-option');
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
