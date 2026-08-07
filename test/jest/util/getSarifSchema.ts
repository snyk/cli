import * as fs from 'fs';
import * as path from 'path';

export async function getSarifSchema(uri: string) {
  // use the filename from the uri and try to load the schema from the local file system
  const url = new URL(uri);
  const filename = path.basename(url.pathname);
  if (filename) {
    const localPath = path.join(__dirname, 'sarif-schemas', filename);
    if (fs.existsSync(localPath)) {
      const content = fs.readFileSync(localPath, 'utf-8');
      return JSON.parse(content);
    }
  }

  try {
    console.warn(`Failed to load cached schema, fetching from ${uri}`);

    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch schema from ${uri}: ${response.statusText}`,
      );
    }
    return response.json();
  } catch (error) {
    throw new Error(`Failed to load schema from ${uri}: ${error.message}`);
  }
}
