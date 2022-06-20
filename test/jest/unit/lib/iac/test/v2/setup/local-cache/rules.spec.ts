import * as fs from 'fs';
import * as path from 'path';
import * as tar from 'tar';
import * as rimraf from 'rimraf';
import { RulesBundleLocator } from '../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/rules';

describe('PathRulesBundleLocator', () => {
  let root: string;
  let userBundlePath: string;
  let cachedBundlePath: string;
  let bundleLocator: RulesBundleLocator;

  beforeEach(() => {
    root = fs.mkdtempSync('root-');
    userBundlePath = path.join(root, 'user-bundle.tar.gz');
    cachedBundlePath = path.join(root, 'cached-bundle.tar.gz');
    bundleLocator = new RulesBundleLocator(cachedBundlePath, userBundlePath);
  });

  afterEach(() => {
    rimraf.sync(root);
  });

  it('should return null if the user and cached bundle do not exist', () => {
    expect(bundleLocator.locateBundle()).toBeNull();
  });

  it('should return the user bundle if it exists and the cached bundle does not exist', () => {
    createArchive(userBundlePath);
    expect(bundleLocator.locateBundle()).toStrictEqual(userBundlePath);
  });

  it('should return the cached bundle if it exists and the user bundle does not exist', () => {
    createArchive(cachedBundlePath);
    expect(bundleLocator.locateBundle()).toStrictEqual(cachedBundlePath);
  });

  it('should return the user bundle if both user and cached bundles exist', () => {
    createArchive(userBundlePath);
    createArchive(cachedBundlePath);
    expect(bundleLocator.locateBundle()).toStrictEqual(userBundlePath);
  });

  it('should throw an error if the user bundle is not a file', () => {
    fs.mkdirSync(userBundlePath);
    expect(() => bundleLocator.locateBundle()).toThrow(
      'user bundle is not a file',
    );
  });

  it('should return null if the cached bundle is not a file', () => {
    fs.mkdirSync(cachedBundlePath);
    expect(bundleLocator.locateBundle()).toBeNull();
  });

  it('should return the cached bundle if no user bundle is specified', () => {
    const bundleLocator = new RulesBundleLocator(cachedBundlePath);
    createArchive(cachedBundlePath);
    expect(bundleLocator.locateBundle()).toStrictEqual(cachedBundlePath);
  });

  it('should return an error if the user bundle is not an archive', () => {
    fs.writeFileSync(userBundlePath, 'not an archive');
    expect(() => bundleLocator.locateBundle()).toThrow(
      'user bundle is not an archive',
    );
  });

  it('should return null if the cached bundle is not an archive', () => {
    fs.writeFileSync(cachedBundlePath, 'not an archive');
    expect(bundleLocator.locateBundle()).toBeNull();
  });
});

function createArchive(file: string) {
  tar.create({ file, gzip: true, sync: true }, [__filename]);
}
