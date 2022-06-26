import * as tar from 'tar';
import { promises as fsPromises, constants as fsConstants } from 'fs';
import { promisify } from 'util';

export async function isExe(path: string): Promise<boolean> {
  try {
    await fsPromises.access(path, fsConstants.X_OK);
    return true;
  } catch (err) {
    return false;
  }
}

export async function isExists(path: string): Promise<boolean> {
  try {
    await fsPromises.stat(path);
    return true;
  } catch (err) {
    return false;
  }
}

export async function createDirIfNotExists(path: string): Promise<void> {
  const isDirExists = await isExists(path);
  if (!isDirExists) {
    fsPromises.mkdir(path, { recursive: true });
  }
}

export async function isFile(path: string): Promise<boolean> {
  try {
    return (await fsPromises.stat(path)).isFile();
  } catch (err) {
    return false;
  }
}

export async function isArchive(path: string): Promise<boolean> {
  try {
    const tarList = promisify(tar.list);
    await tarList({ file: path, strict: true, sync: true }, undefined);
    return true;
  } catch (e) {
    return false;
  }
}

export async function saveFile(
  dataBuffer: Buffer,
  savePath: string,
): Promise<void> {
  await fsPromises.writeFile(savePath, dataBuffer);
  await fsPromises.chmod(savePath, 0o744);
}
