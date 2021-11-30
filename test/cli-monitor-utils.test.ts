import { test } from 'tap';
import * as utils from '../src/lib/monitor/utils';
import { ScannedProject, DepTree } from '@snyk/cli-interface/legacy/common';
import depGraphLib from '@snyk/dep-graph';
import fs from 'fs';
import { MonitorMeta } from '../src/lib/types';
import { PluginMetadata } from '@snyk/cli-interface/legacy/plugin';

const stubScannedProjectContainer = () => {
  return {
    depTree: {},
    meta: {
      imageName: 'some-image',
    },
    targetFile: '/tmp/package.json',
  };
};

const stubScannedProject = () => {
  return {
    depTree: {},
  };
};

const stubDepTree: DepTree = {
  name: 'my-project',
};

const stubDepGraph: depGraphLib.DepGraph = JSON.parse(
  fs.readFileSync('./test/fixtures/dep-graph/dep-graph.json').toString(),
);

const stubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': '',
  isDocker: true,
  prune: false,
};

const overrideNameStubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': 'project-name-override',
  isDocker: true,
  prune: false,
};

const stubPluginMeta: PluginMetadata = {
  name: 'my-plugin',
  targetFile: '/tmp2/package.json',
};

test('getNameDepTree returns name from scanned project if container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = utils.getNameDepTree(scannedProject, stubDepTree, stubMeta);
  t.equal(res, 'some-image:/tmp/package.json');
});

test('getNameDepTree returns name from depTree if not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = utils.getNameDepTree(scannedProject, stubDepTree, stubMeta);
  t.equal(res, 'my-project');
});

test('getNameDepGraph returns name from scanned project if container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = utils.getNameDepGraph(scannedProject, stubDepGraph, stubMeta);
  t.equal(res, 'some-image:/tmp/package.json');
});

test('getNameDepGraph returns name from depGraph if not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = utils.getNameDepGraph(scannedProject, stubDepGraph, stubMeta);
  t.equal(res, 'my-project');
});

test('getProjectName returns name from scanned project if container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = utils.getProjectName(scannedProject, stubMeta);
  t.equal(res, 'some-image');
});

test('getProjectName returns name from meta if not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = utils.getProjectName(scannedProject, overrideNameStubMeta);
  t.equal(res, 'project-name-override');
});

test('getTargetFile returns name from scanned project if container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = utils.getTargetFile(scannedProject, stubPluginMeta);
  t.equal(res, '/tmp/package.json');
});

test('getTargetFile returns name from plugin meta if not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = utils.getTargetFile(scannedProject, stubPluginMeta);
  t.equal(res, '/tmp2/package.json');
});
