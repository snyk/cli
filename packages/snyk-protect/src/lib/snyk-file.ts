const lineRegex = /^(\s*)(.*):(?:$| )+(.*)$/i;

export function extractPatchMetadata(
  dotSnykFileContent: string,
): { [vulnId: string]: string[] } {
  let writingPatches = false;
  let writingTo: string;

  // .snyk parsing => snyk-policy ( or js-yaml )
  const patches = dotSnykFileContent
    .split('\n')
    .filter((l) => l.length && !l.trimStart().startsWith('#'))
    .map((line) => lineRegex.exec(line.trimEnd()))
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
              .substring(1)
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

  return patches;
}
