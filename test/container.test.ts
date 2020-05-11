import { test } from 'tap';
import * as container from '../src/lib/container';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';

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

test('isContainer returns true if image name exists in meta', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  t.true(container.isContainer(scannedProject));
});

test('isContainer returns false if meta is missing', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  t.false(container.isContainer(scannedProject));
});

test('getContainerTargetFile returns nothing if not a container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = container.getContainerTargetFile(scannedProject);
  t.equal(res, undefined);
});

test('getContainerTargetFile returns target file when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerTargetFile(scannedProject);
  t.equal(res, '/tmp/package.json');
});

test('getContainerName returns undefined when not conatiner', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = container.getContainerName(scannedProject);
  t.equal(res, undefined);
});

test('getContainerName returns name+target when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerName(scannedProject);
  t.equal(res, 'some-image:/tmp/package.json');
});

test('getContainerName returns name only when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  scannedProject.targetFile = undefined;
  const res = container.getContainerName(scannedProject);
  t.equal(res, 'some-image');
});

test('getContainerProjectName returns undefined when not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = container.getContainerProjectName(scannedProject);
  t.equal(res, undefined);
});

test('getContainerProjectName returns name only when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerProjectName(scannedProject);
  t.equal(res, 'some-image');
});
