import { test } from 'tap';
import * as container from '../../src/lib/container';
import { ScannedProject } from '@snyk/cli-interface/legacy/common';
import { MonitorMeta } from '../../src/lib/types';
import { config as userConfig } from '../../src/lib/user-config';

const stubScannedProjectContainer = () => {
  return {
    depTree: {},
    meta: {
      imageName: 'some-image',
    },
    targetFile: '/tmp/package.json',
  };
};

const stubScannedProjectContainerWithNoImageName = () => {
  return {
    depTree: {},
    meta: {
      imageName: undefined,
    },
    targetFile: '/tmp/package.json',
  };
};

const stubScannedProjectContainerWithEmptyImageName = () => {
  return {
    depTree: {},
    meta: {
      imageName: '',
    },
    targetFile: '/tmp/package.json',
  };
};

const stubScannedProject = () => {
  return {
    depTree: {},
  };
};
const overriddenNameStubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': 'override-name-my-project',
  isDocker: true,
  prune: false,
};

const stubMeta: MonitorMeta = {
  method: 'cli',
  packageManager: 'npm',
  'policy-path': '',
  'project-name': '',
  isDocker: true,
  prune: false,
};

test('isContainer returns false if image name is undefined', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject =
    stubScannedProjectContainerWithNoImageName();
  t.false(container.isContainer(scannedProject));
});

test('isContainer returns false if image name is empty', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject =
    stubScannedProjectContainerWithEmptyImageName();
  t.false(container.isContainer(scannedProject));
});

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

test('getContainerName returns undefined when not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = container.getContainerName(scannedProject, stubMeta);
  t.equal(res, undefined);
});

test('getContainerName returns name+target when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerName(scannedProject, stubMeta);
  t.equal(res, 'some-image:/tmp/package.json');
});

test('getContainerName returns name only when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  scannedProject.targetFile = undefined;
  const res = container.getContainerName(scannedProject, stubMeta);
  t.equal(res, 'some-image');
});

test('getContainerProjectName returns undefined when not container', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProject();
  const res = container.getContainerProjectName(scannedProject, stubMeta);
  t.equal(res, undefined);
});

test('getContainerProjectName returns name only when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerProjectName(scannedProject, stubMeta);
  t.equal(res, 'some-image');
});

test('getContainerProjectName returns --project-name opt name when container project', (t) => {
  t.plan(1);
  const scannedProject: ScannedProject = stubScannedProjectContainer();
  const res = container.getContainerProjectName(
    scannedProject,
    overriddenNameStubMeta,
  );
  t.equal(res, 'override-name-my-project');
});

test('getContainerImageSavePath return path via config set', (t) => {
  t.plan(1);
  userConfig.set(container.IMAGE_SAVE_PATH_OPT, './my/custom/path');

  const customPath = container.getContainerImageSavePath();

  t.equal(
    customPath,
    './my/custom/path',
    'returns the image save path from config',
  );
  userConfig.delete(container.IMAGE_SAVE_PATH_OPT);
});

test('getContainerImageSavePath return path via env var', (t) => {
  t.plan(1);
  process.env[container.IMAGE_SAVE_PATH_ENV_VAR] = './my/custom/path';

  const customPath = container.getContainerImageSavePath();

  t.equal(
    customPath,
    './my/custom/path',
    'returns the image save path from env var',
  );
  delete process.env[container.IMAGE_SAVE_PATH_ENV_VAR];
});

test('getContainerImageSavePath does not return path', (t) => {
  t.plan(1);
  const customPath = container.getContainerImageSavePath();

  t.notOk(customPath, 'does not returns a path');
});
