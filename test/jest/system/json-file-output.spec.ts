import * as fse from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { saveJsonToFileCreatingDirectoryIfRequired } from '../../../src/lib/json-file-output';

const setupOutput = () => {
  const dir = path.resolve('test-output', uuidv4());
  const outputPath = path.resolve(dir, 'test-output.json');
  return {
    path: outputPath,
    read: async () => {
      return (await fse.readFile(outputPath, 'utf-8')).trim();
    },
    mkdir: async () => {
      await fse.ensureDir(dir);
    },
    remove: async () => {
      await fse.remove(dir);
    },
  };
};

describe('saveJsonToFileCreatingDirectoryIfRequired', () => {
  let output: ReturnType<typeof setupOutput>;

  beforeEach(() => {
    output = setupOutput();
  });

  afterEach(async () => {
    await output.remove();
    jest.restoreAllMocks();
  });

  describe('supports absolute paths', () => {
    it('with directory that does not exists', async () => {
      const input = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      await saveJsonToFileCreatingDirectoryIfRequired(output.path, input);

      await expect(output.read()).resolves.toEqual(input);
    });

    it('with directory that already exists', async () => {
      await output.mkdir();

      const input = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      await saveJsonToFileCreatingDirectoryIfRequired(output.path, input);

      await expect(output.read()).resolves.toEqual(input);
    });
  });

  describe('supports relative paths', () => {
    it('with directory that does not exists', async () => {
      const input = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      await saveJsonToFileCreatingDirectoryIfRequired(output.path, input);

      await expect(output.read()).resolves.toEqual(input);
    });

    it('with directory that already exists', async () => {
      await output.mkdir();

      const input = JSON.stringify({
        ok: true,
        somekey: 'someval',
      });

      await saveJsonToFileCreatingDirectoryIfRequired(output.path, input);

      await expect(output.read()).resolves.toEqual(input);
    });
  });
});
