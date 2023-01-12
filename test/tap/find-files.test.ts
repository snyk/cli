import * as path from 'path';
import { test } from 'tap';
import { find } from '../../src/lib/find-files';
import { getFixturePath } from '../jest/util/getFixturePath';

const testFixture = getFixturePath('find-files');

test('find all files in test fixture', async (t) => {
  // six levels deep to find all
  const { files: result, allFilesFound } = await find(testFixture, [], [], 6);
  const expected = [
    path.join(
      testFixture,
      'golang',
      'golang-app-govendor',
      'vendor',
      'vendor.json',
    ),
    path.join(testFixture, 'golang', 'golang-app', 'Gopkg.lock'),
    path.join(testFixture, 'golang', 'golang-gomodules', 'go.mod'),
    path.join(testFixture, 'gradle', 'build.gradle'),
    path.join(testFixture, 'gradle-kts', 'build.gradle.kts'),
    path.join(testFixture, 'gradle-and-kotlin', 'build.gradle'),
    path.join(testFixture, 'gradle-multiple', 'gradle/build.gradle'),
    path.join(testFixture, 'gradle-multiple', 'gradle-another/build.gradle'),
    path.join(testFixture, 'maven', 'pom.xml'),
    path.join(testFixture, 'npm-with-lockfile', 'package-lock.json'),
    path.join(testFixture, 'mvn', 'pom.xml'),
    path.join(testFixture, 'npm', 'package.json'),
    path.join(testFixture, 'ruby', 'Gemfile.lock'),
    path.join(testFixture, 'yarn', 'yarn.lock'),
    path.join(testFixture, 'swift', 'test.build', 'Package.swift'),
  ];
  const filteredOut = [
    path.join(testFixture, 'golang', 'golang-app', 'Gopkg.toml'),
    path.join(testFixture, 'README.md'),
    path.join(testFixture, 'yarn', 'package.json'),
    path.join(testFixture, 'ruby', 'Gemfile'),
    path.join(testFixture, 'gradle-kts', 'subproj', 'build.gradle.kts'),
    path.join(testFixture, 'npm-with-lockfile', 'package.json'),
    path.join(testFixture, 'gradle', 'subproject', 'build.gradle'),
    path.join(testFixture, 'gradle-and-kotlin', 'build.gradle.kts'),
    path.join(
      testFixture,
      'gradle-multiple',
      'gradle',
      'subproject',
      'build.gradle',
    ),
    path.join(
      testFixture,
      'gradle-multiple',
      'gradle-another',
      'subproject',
      'build.gradle',
    ),
    path.join(testFixture, 'maven', 'test.txt'),
    path.join(testFixture, 'mvn', 'test.txt'),
    path.join(testFixture, 'npm', 'test.txt'),
    path.join(testFixture, 'ruby', 'test.txt'),
  ];
  t.same(result.length, expected.length, 'should be the same length');
  t.same(result.sort(), expected.sort(), 'should return all files');
  t.same(
    allFilesFound.filter((f) => !f.endsWith('broken-symlink')).sort(),
    [...filteredOut, ...expected].sort(),
    'should return all unfiltered files',
  );
});

test('find all files in test fixture ignoring node_modules', async (t) => {
  // six levels deep to ensure node_modules is tested
  const { files: result } = await find(testFixture, ['node_modules'], [], 6);
  const expected = [
    path.join(
      testFixture,
      'golang',
      'golang-app-govendor',
      'vendor',
      'vendor.json',
    ),
    path.join(testFixture, 'golang', 'golang-app', 'Gopkg.lock'),
    path.join(testFixture, 'golang', 'golang-gomodules', 'go.mod'),
    path.join(testFixture, 'gradle', 'build.gradle'),
    path.join(testFixture, 'gradle-kts', 'build.gradle.kts'),
    path.join(testFixture, 'gradle-and-kotlin', 'build.gradle'),
    path.join(testFixture, 'gradle-multiple', 'gradle/build.gradle'),
    path.join(testFixture, 'gradle-multiple', 'gradle-another/build.gradle'),
    path.join(testFixture, 'maven', 'pom.xml'),
    path.join(testFixture, 'mvn', 'pom.xml'),
    path.join(testFixture, 'npm-with-lockfile', 'package-lock.json'),
    path.join(testFixture, 'npm', 'package.json'),
    path.join(testFixture, 'swift', 'test.build', 'Package.swift'),
    path.join(testFixture, 'ruby', 'Gemfile.lock'),
    path.join(testFixture, 'yarn', 'yarn.lock'),
  ];
  t.same(result.sort(), expected.sort(), 'should return expected files');
});

test('find package.json file in test fixture ignoring node_modules', async (t) => {
  // six levels deep to ensure node_modules is tested
  const nodeModulesPath = path.join(testFixture, 'node_modules');
  const { files: result } = await find(
    nodeModulesPath,
    [],
    ['package.json'],
    6,
  );
  const expected = [];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find Package.swift file in test fixture ignoring .build folder', async (t) => {
  // six levels deep to ensure .build is tested
  const nodeModulesPath = path.join(testFixture, '.build');
  const { files: result } = await find(
    nodeModulesPath,
    [],
    ['Package.swift'],
    6,
  );
  const expected = [];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});
test('find Package.swift file in test fixture ignoring test.build folder ', async (t) => {
  const nodeModulesPath = path.join(testFixture, 'swift', 'test.build');
  const { files: result } = await find(
    nodeModulesPath,
    [],
    ['Package.swift'],
    6,
  );
  const expected = [
    path.join(testFixture, 'swift', 'test.build', 'Package.swift'),
  ];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find package.json file in test fixture (by default ignoring node_modules)', async (t) => {
  // six levels deep to ensure node_modules is tested
  const { files: result } = await find(testFixture, [], ['package.json'], 6);
  const expected = [
    path.join(testFixture, 'npm', 'package.json'),
    path.join(testFixture, 'npm-with-lockfile', 'package.json'),
    path.join(testFixture, 'yarn', 'package.json'),
  ];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find package-lock.json file in test fixture (ignore package.json in the same folder)', async (t) => {
  const npmLockfilePath = path.join(testFixture, 'npm-with-lockfile');

  const { files: result } = await find(
    npmLockfilePath,
    [],
    ['package.json', 'package-lock.json'],
    1,
  );
  const expected = [path.join(npmLockfilePath, 'package-lock.json')];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find build.gradle file in test fixture (ignore build.gradle in the same folder)', async (t) => {
  const buildGradle = path.join(testFixture, 'gradle-and-kotlin');

  const { files: result } = await find(
    buildGradle,
    [],
    ['build.gradle.kts', 'build.gradle'],
    1,
  );
  const expected = [path.join(buildGradle, 'build.gradle')];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find Gemfile.lock file in test fixture (ignore Gemfile in the same folder)', async (t) => {
  const npmLockfilePath = path.join(testFixture, 'ruby');

  const { files: result } = await find(
    npmLockfilePath,
    [],
    ['Gemfile', 'Gemfile.lock'],
    1,
  );
  const expected = [path.join(npmLockfilePath, 'Gemfile.lock')];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find yarn.lock file in test fixture (ignore package.json in the same folder)', async (t) => {
  const yarnLockfilePath = path.join(testFixture, 'yarn');

  const { files: result } = await find(
    yarnLockfilePath,
    [],
    ['package.json', 'yarn.lock'],
    1,
  );
  const expected = [path.join(yarnLockfilePath, 'yarn.lock')];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find package.json file in test fixture (by default ignoring node_modules)', async (t) => {
  // four levels deep to ensure node_modules is tested
  const { files: result } = await find(testFixture, [], ['package.json'], 4);
  const expected = [
    path.join(testFixture, 'npm', 'package.json'),
    path.join(testFixture, 'npm-with-lockfile', 'package.json'),
    path.join(testFixture, 'yarn', 'package.json'),
  ];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find Gemfile file in test fixture', async (t) => {
  const { files: result } = await find(testFixture, [], ['Gemfile']);
  const expected = [path.join(testFixture, 'ruby', 'Gemfile')];
  t.same(result.sort(), expected.sort(), 'should return expected file');
});

test('find pom.xml files in test fixture', async (t) => {
  const { files: result } = await find(testFixture, [], ['pom.xml']);
  const expected = [
    path.join(testFixture, 'maven', 'pom.xml'),
    path.join(testFixture, 'mvn', 'pom.xml'),
  ];
  t.same(result.sort(), expected, 'should return expected files');
});

test('find path that does not exist', async (t) => {
  try {
    await find('does-not-exist');
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.match(
      err.message,
      'Error finding files in path',
      'throws expected exception',
    );
  }
});

test('find path is empty string', async (t) => {
  try {
    await find('');
    t.fail('expected exception to be thrown');
  } catch (err) {
    t.match(
      err.message,
      'Error finding files in path',
      'throws expected exception',
    );
  }
});
