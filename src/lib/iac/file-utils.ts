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
