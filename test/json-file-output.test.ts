import tap from 'tap';
const fs = require('fs');
import pathLib from 'path';
import { gte } from 'semver';
const osName = require('os-name');

import {
  createDirectory,
  MIN_VERSION_FOR_MKDIR_RECURSIVE,
  writeContentsToFileSwallowingErrors,
} from '../src/lib/json-file-output';

const iswindows =
  osName()
    .toLowerCase()
    .indexOf('windows') === 0;

const test = tap.test;

const testOutputRelative = 'test-output';
const testOutputFull = pathLib.join(process.cwd(), testOutputRelative);

const levelOneRelative = 'test-output/level-one';
const levelOneFull = pathLib.join(process.cwd(), levelOneRelative);

const readonlyRelative = 'test-output/read-only';
const readonlyFull = pathLib.join(process.cwd(), readonlyRelative);
const testOutputFileFull = pathLib.join(testOutputFull, 'test-output.json');

tap.beforeEach((done) => {
  cleanupOutputDirsAndFiles();
  done();
});

tap.teardown(() => {
  cleanupOutputDirsAndFiles();
});

function cleanupOutputDirsAndFiles() {
  if (fs.existsSync(levelOneFull)) {
    fs.rmdirSync(levelOneFull);
  }
  if (fs.existsSync(testOutputFileFull)) {
    console.log(`attempting to delete file ${testOutputFileFull}`);
    fs.unlinkSync(testOutputFileFull);
    if (fs.existsSync(testOutputFileFull)) {
      console.log(
        `${testOutputFileFull} still exists after attempting to delete it`,
      );
    } else {
      console.log(`${testOutputFileFull} appears to have been deleted`);
    }
  }
  if (fs.existsSync(readonlyFull)) {
    fs.rmdirSync(readonlyFull);
  }

  // try-catch because seems like in Windows we can't delete the test-output directory because it
  // thinks testOutputFileFull still exists
  try {
    if (fs.existsSync(testOutputFull)) {
      fs.rmdirSync(testOutputFull);
    }
  } catch {
    console.log('Error trying to delete test-output directory');
    const files = fs.readdirSync(testOutputFull);
    files.forEach((file) => {
      console.log(file);
    });
  }
}

test('createDirectory returns true if directory already exists - non-recursive', (t) => {
  t.plan(2);

  // initially create the directory
  fs.mkdirSync(testOutputFull);

  // attempt to create the directory
  const success: boolean = createDirectory(testOutputFull);
  t.ok(success);

  const directoryExists = fs.existsSync(testOutputFull);
  t.ok(directoryExists);
});

test('createDirectory creates directory - recursive', (t) => {
  t.plan(2);

  // attempt to create the directory requiring recursive
  const success: boolean = createDirectory(levelOneFull);
  const directoryExists = fs.existsSync(levelOneFull);

  // recursive should fail (return false) for node < 10 LTS and pass (return true) for node >= 10 LTS
  // if node >= 10, verify that the deep folder was created
  // if node 8 verify that the deep folder was not created
  const nodeVersion = process.version;
  if (gte(nodeVersion, MIN_VERSION_FOR_MKDIR_RECURSIVE)) {
    t.ok(success);
    t.ok(directoryExists);
  } else {
    t.notOk(success);
    t.notOk(directoryExists);
  }
});

test('writeContentsToFileSwallowingErrors can write a file', async (t) => {
  t.plan(1);

  // initially create the directory
  fs.mkdirSync(testOutputFull);

  // this should throw an error within writeContentsToFileSwallowingErrors but that error should be caught, logged, and disregarded
  await writeContentsToFileSwallowingErrors(
    testOutputFileFull,
    'fake-contents',
  );
  const fileExists = fs.existsSync(testOutputFileFull);
  t.ok(fileExists, 'and file exists after writing it');
});

test(
  'writeContentsToFileSwallowingErrors captures any errors when attempting to write to a readonly directory',
  { skip: iswindows },
  async (t) => {
    t.plan(2);

    // initially create the directory
    fs.mkdirSync(testOutputFull);

    // create a directory without write permissions
    fs.mkdirSync(readonlyFull, 0o555);

    const outputPath = pathLib.join(readonlyFull, 'test-output.json');

    await writeContentsToFileSwallowingErrors(outputPath, 'fake-contents');
    const fileExists = fs.existsSync(outputPath);
    t.equals(fileExists, false);
    t.pass('no exception is thrown'); // we expect to not get an error even though we can't write to this folder
  },
);
