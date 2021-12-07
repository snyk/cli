import * as path from 'path';
import * as fs from 'fs';

export function createOldStylePatchAppliedFlagFilename(vulnId: string) {
  const fileSafeVulnId = vulnId.replace(/:/g, '-'); // replace colon with dash for windows compatibility
  return `.snyk-${fileSafeVulnId}.flag`;
}

export function applyPatchToFile(
  patchContents: string,
  baseFolder: string,
  vulnId: string,
) {
  const targetFilePath = path.join(
    baseFolder,
    extractTargetFilePathFromPatch(patchContents),
  );

  const flagPath = `${targetFilePath}.snyk-protect.flag`;
  const origPatchFlagPath = `${targetFilePath}.orig`;
  if (fs.existsSync(flagPath) || fs.existsSync(origPatchFlagPath)) {
    return targetFilePath;
  }

  const contentsToPatch = fs.readFileSync(targetFilePath, 'utf-8');
  const patchedContents = patchString(patchContents, contentsToPatch);
  fs.writeFileSync(targetFilePath, patchedContents);
  fs.writeFileSync(flagPath, '');

  const oldStyleFlagFilenamePath = path.resolve(
    baseFolder,
    createOldStylePatchAppliedFlagFilename(vulnId),
  );
  const now = new Date().toISOString();
  fs.writeFileSync(oldStyleFlagFilenamePath, now);

  return targetFilePath;
}

export function extractTargetFilePathFromPatch(patchContents: string): string {
  const patchContentLines = patchContents
    .slice(patchContents.search(/^--- a\//m))
    .split('\n');
  const filename = patchContentLines[0].replace('--- a/', '');
  return filename;
}

const getNextLine = (currentLine: string, patchLine: string): string => {
  const maybeCarriageReturn =
    currentLine.endsWith('\r') && !patchLine.endsWith('\r') ? '\r' : '';
  return patchLine.substring(1) + maybeCarriageReturn;
};

const getPatchType = (patchLine: string): string => patchLine.charAt(0);

export function patchString(
  patchContents: string,
  contentsToPatch: string,
): string {
  const patchContentLines = patchContents
    .slice(patchContents.search(/^--- a\//m))
    .split('\n');

  const contentsToPatchLines = contentsToPatch.split('\n');

  if (!patchContentLines[2]) {
    throw new Error('Invalid patch.');
  }
  const unparsedLineToPatch = /^@@ -(\d*),.*@@/.exec(patchContentLines[2]);
  if (!unparsedLineToPatch || !unparsedLineToPatch[1]) {
    throw new Error('Invalid patch.');
  }
  let lineToPatch = parseInt(unparsedLineToPatch[1], 10) - 2;

  const patchLines = patchContentLines.slice(3, patchContentLines.length - 2);

  for (const patchLine of patchLines) {
    lineToPatch += 1;
    const currentLine = contentsToPatchLines[lineToPatch];
    const nextLine = getNextLine(currentLine, patchLine);
    switch (getPatchType(patchLine)) {
      case '-': {
        contentsToPatchLines.splice(lineToPatch, 1);
        break;
      }
      case '+': {
        contentsToPatchLines.splice(lineToPatch, 0, nextLine);
        break;
      }
      case ' ': {
        if (currentLine !== nextLine) {
          throw new Error(
            'File does not match patch contents.' +
              '  Expected\n' +
              '    line from local file\n' +
              `      ${JSON.stringify(currentLine)}\n` +
              '    to match patch line\n' +
              `      ${JSON.stringify(nextLine)}\n`,
          );
        }
        break;
      }
    }
  }

  return contentsToPatchLines.join('\n');
}
