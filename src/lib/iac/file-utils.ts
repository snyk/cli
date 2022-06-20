import * as fs from 'fs';
import { promises as fsPromises } from 'fs';

export async function isExe(path: string): Promise<boolean> {
  try {
    await fsPromises.access(path, fs.constants.X_OK);
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
