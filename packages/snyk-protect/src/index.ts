import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

async function protect() {
  let writingPatches = false;
  let writingTo: string;

  // .snyk parsing => snyk-policy ( or js-yaml )
  const patches = fs
    .readFileSync('.snyk', 'utf8')
    .split('\n')
    .filter((l) => l.length && !l.trimStart().startsWith('#'))
    .map(/^(\s*)(.*):(?:$| )+(.*)$/i.exec)
    .filter(Boolean)
    .reduce((acc, thing) => {
      const [, prefix, key, value] = thing as RegExpExecArray;
      if (writingPatches && prefix === '') {
        writingPatches = false;
      } else if (prefix === '' && key === 'patch' && value === '') {
        writingPatches = true;
      } else if (writingPatches) {
        if (prefix.length === 2) {
          writingTo = key;
          acc[key] = [];
        } else {
          if (key.startsWith('-')) {
            const destination = key
              .split('>')
              .pop()
              ?.trim();
            if (!acc[writingTo].includes(destination)) {
              acc[writingTo].push(destination);
            }
          }
        }
      }
      return acc;
    }, {});

  const librariesOfInterest = Object.values(patches).flat();
  const patchesOfInterest = Object.keys(patches);
  const foundLibraries: any[] = [];

  // parse node_modules
  function isDependencyToBePatched(folderName, folderPath) {
    if (!librariesOfInterest.includes(folderName)) {
      return false;
    }

    const packageJsonPath = path.resolve(folderPath, 'package.json');
    if (
      fs.existsSync(packageJsonPath) &&
      fs.lstatSync(packageJsonPath).isFile()
    ) {
      const { name, version } = JSON.parse(
        fs.readFileSync(packageJsonPath, 'utf8'),
      );
      if (librariesOfInterest.includes(name)) {
        foundLibraries.push({
          name,
          version,
          folderPath,
        });
      }
    }
  }
  function checkProject(pathToCheck) {
    if (fs.existsSync(pathToCheck) && fs.lstatSync(pathToCheck).isDirectory()) {
      const folderName = path.basename(pathToCheck);
      isDependencyToBePatched(folderName, pathToCheck);
      const folderNodeModules = path.resolve(pathToCheck, 'node_modules');
      if (
        fs.existsSync(folderNodeModules) &&
        fs.lstatSync(folderNodeModules).isDirectory()
      ) {
        fs.readdirSync(folderNodeModules).forEach((p) => {
          checkProject(path.resolve(folderNodeModules, p));
        });
      }
    }
  }
  checkProject(path.resolve(__dirname, '.'));

  // fetch patches => needle
  const httpsGet = (url: string, options: any = {}): Promise<any> =>
    new Promise((resolve, reject) => {
      const parsedURL = new URL(url);
      const requestOptions = {
        ...options,
        host: parsedURL.host,
        path: parsedURL.pathname,
      };
      const request = https.get(requestOptions, (response) => {
        if (
          response.statusCode &&
          (response.statusCode < 200 || response.statusCode > 299)
        ) {
          reject(
            new Error(
              'Failed to load page, status code: ' + response.statusCode,
            ),
          );
        }
        const body: any[] = [];
        response.on('data', (chunk: any) => body.push(chunk));
        response.on('end', () =>
          resolve(options.json ? JSON.parse(body.join('')) : body.join('')),
        );
      });
      request.on('error', reject);
    });

  async function getPatches() {
    const snykPatches = {};
    const checkedLibraries: any[] = [];
    for (const foundLibrary of foundLibraries) {
      const toCheck = `${foundLibrary.name}/${foundLibrary.version}`;
      if (!checkedLibraries.includes(toCheck)) {
        checkedLibraries.push(toCheck);
        const { issues } = await httpsGet(
          `https://snyk.io/api/v1/test/npm/${toCheck}`,
          {
            json: true,
            headers: {
              Authorization: `token ${process.env.SNYK_TOKEN}`,
              'Content-Type': 'application/json',
            },
          },
        );
        if (issues.vulnerabilities) {
          for (const vulnerability of issues.vulnerabilities) {
            if (patchesOfInterest.includes(vulnerability.id)) {
              snykPatches[vulnerability.package] =
                snykPatches[vulnerability.package] || [];
              const fetchedPatches = await Promise.all(
                vulnerability.patches.map(async (patch) => {
                  return {
                    ...patch,
                    diffs: await Promise.all(
                      patch.urls.map(async (url) => httpsGet(url)),
                    ),
                  };
                }),
              );
              snykPatches[vulnerability.package] = [...fetchedPatches];
            }
          }
        }
      }
    }
    return snykPatches;
  }

  const snykPatches = await getPatches();
  if (Object.keys(snykPatches).length === 0) {
    console.log('Nothing to patch, done');
    return;
  }

  for (const [libToPatch, patches] of Object.entries(snykPatches)) {
    for (const place of foundLibraries.filter((l) => l.name === libToPatch)) {
      for (const patch of patches as any) {
        for (const patchDiff of (patch as any).diffs) {
          applyDiff(patchDiff, place.folderPath);
        }
      }
    }
  }
}

// apply patches => patch apply || git apply || js-diff
function applyDiff(patchDiff: string, baseFolder: string) {
  const patchFile = patchDiff.slice(patchDiff.search(/^--- a\//m)).split('\n');
  const filename = path.resolve(baseFolder, patchFile[0].replace('--- a/', ''));

  const fileToPatch = fs.readFileSync(filename, 'utf-8').split('\n');
  if (!patchFile[2]) {
    return;
  }
  const unparsedLineToPatch = /^@@ -(\d*),.*@@/.exec(patchFile[2]);
  if (!unparsedLineToPatch || !unparsedLineToPatch[1]) {
    return;
  }
  let lineToPatch = parseInt(unparsedLineToPatch[1], 10) - 2;

  const patchLines = patchFile.slice(3, patchFile.length - 2);

  for (const patchLine of patchLines) {
    lineToPatch += 1;
    switch (patchLine.charAt(0)) {
      case '-':
        fileToPatch.splice(lineToPatch, 1);
        break;

      case '+':
        fileToPatch.splice(lineToPatch, 0, patchLine);
        break;

      case ' ':
        if (fileToPatch[lineToPatch] !== patchLine.slice(1)) {
          console.log(
            'Expected\n  line from local file\n',
            fileToPatch[lineToPatch],
          );
          console.log('\n to match patch line\n', patchLine.slice(1), '\n');
          throw new Error(
            `File ${filename} to be patched does not match, not patching`,
          );
        }
        break;
    }
  }

  // fs.writeFileSync(filename, patchLines.join('\n'))
}

export default protect;
