// Util for file ignore rules tests
// this creates the file structure for testing native code file ignore rules
// the structure gets created in test/fixtures/file-ignore-rules

import * as fs from 'fs';
import * as path from 'path';

const folders = [
  'folder',
  'folder/wildcard-suffix-goodbye',
  'prefix-wildcard-sandwich-suffix',
  'prefix-wildcard-sandwich-suffix/sub-folder',
];

const files = [
  'HashingAssignment.java',
  'folder/HashingAssignment.java',
  'HashingAssignment$.java',
  'folder/HashingAssignment$.java',
  'folder/hello-wildcard-prefix.java',
  'folder/wildcard-suffix-goodbye/HashingAssignment.java',
  'prefix-wildcard-sandwich-suffix/HashingAssignment.java',
  'prefix-wildcard-sandwich-suffix/sub-folder/HashingAssignment.java',
];

const projectRoot = path.join(__dirname, '../../..');
const baseFilePath = path.join(
  projectRoot,
  'test/fixtures/file-ignore-rules/HashingAssignment.java',
);

export function createFilepaths(basePath: string) {
  // create folders and expected ignored folders
  folders.forEach((folder) => {
    fs.mkdirSync(path.join(basePath, folder), { recursive: true });
  });

  // copy base file to each path
  files.forEach((file) => {
    fs.copyFileSync(baseFilePath, path.join(basePath, file));
  });
}

export function deleteFilepaths(basePath: string) {
  files.forEach((file) => {
    // do not delete the base file
    if (file !== 'HashingAssignment.java') {
      fs.unlinkSync(path.join(basePath, file));
    }
  });

  if (fs.existsSync(basePath)) {
    fs.rmSync(basePath, { recursive: true });
  }
}
