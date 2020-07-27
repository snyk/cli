import { createWriteStream } from 'fs';

export function writeContentsToFileSwallowingErrors(
  jsonOutputFile: string,
  contents: string,
) {
  try {
    const ws = createWriteStream(jsonOutputFile, { flags: 'w' });
    ws.on('error', (err) => {
      console.error(err);
    });
    ws.write(contents);
    ws.end('\n');
  } catch (err) {
    console.error(err);
  }
}
