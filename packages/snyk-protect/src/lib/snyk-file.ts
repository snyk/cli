import { VulnIdAndPackageName } from './types';
import { deQuote } from './utils';

const lineRegex = /^(\s*)(.*):(?:$| )+(.*)$/i;

export function extractPatchMetadata(
  dotSnykFileContent: string,
): VulnIdAndPackageName[] {
  let writingPatches = false;
  let writingTo: string;

  // .snyk parsing => snyk-policy ( or js-yaml )
  const patches: { [vulnId: string]: string[] } = dotSnykFileContent
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
              ?.trim()
              ?.replace(/['"]/g, '');
            if (!acc[writingTo].includes(destination)) {
              acc[writingTo].push(destination);
            }
          }
        }
      }
      return acc;
    }, {});

  const vulnIdAndPackageNames: VulnIdAndPackageName[] = [];
  for (const vulnId of Object.keys(patches)) {
    const packageNames = patches[vulnId];
    if (packageNames.length === 0) {
      throw new Error(
        'should never have no package names for a vulnId in a .snyk file',
      );
    } else if (packageNames.length > 1) {
      throw new Error(
        'should never have more than one package name for a vulnId in a .snyk file',
      );
    } else {
      vulnIdAndPackageNames.push({
        vulnId: deQuote(vulnId.trim()),
        packageName: packageNames[0],
      });
    }
  }

  return vulnIdAndPackageNames;
}
