import * as path from 'path';
import * as fs from 'fs';

export function applyPatchToFile(patchContents: string, baseFolder: string) {
  const targetFilePath = path.join(
    baseFolder,
    extractTargetFilePathFromPatch(patchContents),
  );
  const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');
  const patchedContents = patchString(patchContents, contentsToPatch);
  fs.writeFileSync(targetFilePath, patchedContents);
  console.log(`patched ${targetFilePath}`);
}

export function extractTargetFilePathFromPatch(patchContents: string): string {
  const patchContentLines = patchContents
    .slice(patchContents.search(/^--- a\//m))
    .split('\n');
  const filename = patchContentLines[0].replace('--- a/', '');
  return filename;
}

export function patchString(
  patchContents: string,
  contentsToPatch: string,
): string {
  const patchContentLines = patchContents
    .slice(patchContents.search(/^--- a\//m))
    .split('\n');

  const contentsToPatchLines = contentsToPatch.split('\n');

  if (!patchContentLines[2]) {
    // return;
    throw new Error('Invalid patch');
  }
  const unparsedLineToPatch = /^@@ -(\d*),.*@@/.exec(patchContentLines[2]);
  if (!unparsedLineToPatch || !unparsedLineToPatch[1]) {
    // return;
    throw new Error('Invalid patch');
  }
  let lineToPatch = parseInt(unparsedLineToPatch[1], 10) - 2;

  const patchLines = patchContentLines.slice(3, patchContentLines.length - 2);

  for (const patchLine of patchLines) {
    lineToPatch += 1;
    switch (patchLine.charAt(0)) {
      case '-':
        contentsToPatchLines.splice(lineToPatch, 1);
        break;

      case '+':
        contentsToPatchLines.splice(lineToPatch, 0, patchLine.substring(1));
        break;

      case ' ':
        if (contentsToPatchLines[lineToPatch] !== patchLine.slice(1)) {
          console.log(
            'Expected\n  line from local file\n',
            contentsToPatchLines[lineToPatch],
          );
          console.log('\n to match patch line\n', patchLine.slice(1), '\n');
          throw new Error(
            // `File ${filename} to be patched does not match, not patching`,
            `File to be patched does not match, not patching`,
          );
        }
        break;
    }
  }
  return contentsToPatchLines.join('\n');
}
