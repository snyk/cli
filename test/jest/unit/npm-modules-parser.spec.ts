import { parse } from '../../../src/lib/plugins/nodejs-plugin/npm-modules-parser';
import { getFileContents } from '../../../src/lib/get-file-contents';

jest.mock('../../../src/lib/get-file-contents');
const mockedGetFileContents = jest.mocked(getFileContents, { shallow: true });

afterEach(() => {
  jest.clearAllMocks();
});

const packageJsonNoNameAndNoDeps = {
  description: '',
  main: 'index.js',
  scripts: {
    test: 'echo "Error: no test specified" && exit 1',
  },
  author: '',
  license: 'ISC',
};

const packageJsonNoDeps = {
  name: 'test-package',
  description: '',
  main: 'index.js',
  scripts: {
    test: 'echo "Error: no test specified" && exit 1',
  },
  author: '',
  license: 'ISC',
};

describe('npm-modules-parser', () => {
  describe('parse', () => {
    it('package name should fall back to "package.json" when no name and no dependencies', async () => {
      mockedGetFileContents.mockImplementation(() => ({
        content: JSON.stringify(packageJsonNoNameAndNoDeps),
        fileName: 'package.json',
      }));

      const result = await parse('some/fake/path', 'package.json', {
        packageManager: 'npm',
        file: 'package.json',
      });

      expect(result.name).toBe('package.json');
    });

    it('package name should match package.json when no dependencies', async () => {
      mockedGetFileContents.mockImplementation(() => ({
        content: JSON.stringify(packageJsonNoDeps),
        fileName: 'package.json',
      }));

      const result = await parse('some/fake/path', 'package.json', {
        packageManager: 'npm',
        file: 'package.json',
      });

      expect(result.name).toBe('test-package');
    });
  });
});
