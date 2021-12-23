import { MethodArgs } from '../args';
import { promises, Stats } from 'fs';
import * as crypto from 'crypto';
import * as AdmZip from 'adm-zip';
import * as ora from 'ora';
import * as semver from 'semver';
import { FileSignatureDetails, vulnerableSignatures } from './log4shell-hashes';

const readFile = promises.readFile;
const readDir = promises.readdir;
const stat = promises.stat;
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 - 1;

type ExploitType = 'Log4Shell' | 'DoS' | 'Unknown';
type Signature = {
  value: string;
  path: string;
  exploitType: ExploitType;
};
type FileContent = Buffer;
type FilePath = string;
type Digest = string;

type File = {
  path: FilePath;
  content: () => Promise<FileContent>;
};

class Paths {
  paths: Array<File>;

  constructor(paths: Array<File>) {
    this.paths = paths;
  }

  static empty() {
    return new Paths([]);
  }

  static fromZip(content: FileContent, path: FilePath) {
    try {
      const unzippedEntries = new AdmZip(content).getEntries();

      const entries: File[] = unzippedEntries.map((entry) => {
        return {
          path: path + '/' + entry.entryName,
          content: async () => entry.getData(),
        };
      });

      return new Paths(entries);
    } catch (error) {
      errors.push(error);

      return this.empty();
    }
  }

  static async fromDisk(paths: FilePath[]) {
    try {
      const entries = paths.map((path) => {
        return {
          path,
          content: async () => await readFile(path),
        };
      });

      return new Paths(entries);
    } catch (error) {
      errors.push(error);

      return this.empty();
    }
  }
}

interface FileHandler {
  (filePath: string, stats: Stats): void;
}

const errors: any[] = [];

async function startSpinner(): Promise<ora.Ora> {
  const spinner: ora.Ora = ora({ isSilent: false, stream: process.stdout });
  spinner.text = `Looking for Log4Shell...`;
  spinner.start();

  return spinner;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default async function log4shell(...args: MethodArgs): Promise<void> {
  console.log(
    'Please note this command is for already built artifacts. To test source code please use `snyk test`.',
  );

  const signatures: Array<Signature> = new Array<Signature>();
  const spinner = await startSpinner();

  const paths: FilePath[] = await find('.');

  await parsePaths(await Paths.fromDisk(paths), signatures);

  spinner.stop();

  console.log('\nResults:');

  const issues = filterJndi(signatures);
  if (issues.length == 0) {
    console.log('No known vulnerable version of Log4J was detected');
    return;
  }
  const rceIssues: Signature[] = [];
  const dosIssues: Signature[] = [];

  issues.forEach((issue) => {
    issue.path = issue.path.replace(
      /(.*org\/apache\/logging\/log4j\/core).*/,
      '$1',
    );

    if (issue.exploitType === 'Log4Shell') {
      rceIssues.push(issue);
    }
    if (issue.exploitType === 'DoS') {
      dosIssues.push(issue);
    }
  });

  if (rceIssues.length > 0) {
    displayIssues(
      'A version of Log4J that is vulnerable to Log4Shell was detected:',
      rceIssues,
    );
    displayRemediation('Log4Shell');
  }

  if (dosIssues.length > 0) {
    displayIssues(
      'A version of Log4J that is vulnerable to CVE-2021-45105 (Denial of Service) was detected:',
      dosIssues,
    );
    displayRemediation('DoS');
  }

  exitWithError();
}

async function parsePaths(ctx: Paths, accumulator: Array<Signature>) {
  for (const { path, content } of ctx.paths) {
    if (!isArchiveOrJndi(path)) {
      continue;
    }

    const signature = await computeSignature(await content());
    const isVulnerable = signature in vulnerableSignatures;

    if (isVulnerable || path.includes('JndiLookup')) {
      await append(path, signature, accumulator);
      continue;
    }

    if (!isVulnerable && isJavaArchive(path)) {
      await parsePaths(Paths.fromZip(await content(), path), accumulator);
    }
  }
}

async function computeSignature(content: FileContent): Promise<Digest> {
  return crypto
    .createHash('md5')
    .update(content)
    .digest('base64')
    .replace(/=/g, '');
}

async function find(path: FilePath): Promise<FilePath[]> {
  const result: FilePath[] = [];

  await traverse(path, (filePath: string, stats: Stats) => {
    if (!stats.isFile() || stats.size > MAX_FILE_SIZE) {
      return;
    }
    result.push(filePath);
  });

  return result;
}

async function traverse(path: FilePath, handle: FileHandler) {
  try {
    const stats = await stat(path);

    if (!stats.isDirectory()) {
      handle(path, stats);
      return;
    }

    const entries = await readDir(path);
    for (const entry of entries) {
      const absolute = path + '/' + entry;
      await traverse(absolute, handle);
    }
  } catch (error) {
    errors.push(error);
  }
}

async function computeExploitType(
  signatureDetails: FileSignatureDetails,
): Promise<ExploitType> {
  for (const version of signatureDetails.versions) {
    const coercedVersion = semver.coerce(version);

    if (coercedVersion === null) {
      continue;
    }

    if (semver.lt(coercedVersion, '2.16.0')) {
      return 'Log4Shell';
    }

    if (semver.satisfies(coercedVersion, '2.16.x')) {
      return 'DoS';
    }
  }

  return 'Unknown';
}

function displayIssues(message: string, signatures: Signature[]) {
  console.log(message);
  signatures.forEach((signature) => {
    console.log(`\t${signature.path}`);
  });
}

function displayRemediation(exploitType: ExploitType) {
  switch (exploitType) {
    case 'Log4Shell':
      console.log(`\nWe highly recommend fixing this vulnerability. If it cannot be fixed by upgrading, see mitigation information here:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720
      \t- https://snyk.io/blog/log4shell-remediation-cheat-sheet/\n`);
      break;

    case 'DoS':
      console.log(`\nWe recommend fixing this vulnerability by upgrading to a later version. To learn more about this vulnerability, see:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2321524\n`);
      break;

    default:
      break;
  }
}

function isJavaArchive(path: FilePath) {
  return path.endsWith('.jar') || path.endsWith('.war') || path.endsWith('ear');
}

function isArchiveOrJndi(path: FilePath) {
  return (
    isJavaArchive(path) ||
    path.includes('JndiManager') ||
    path.includes('JndiLookup')
  );
}

async function append(
  path: FilePath,
  signature: Digest,
  accumulator: Array<Signature>,
): Promise<void> {
  const exploitType = vulnerableSignatures[signature]
    ? await computeExploitType(vulnerableSignatures[signature])
    : 'Unknown';

  accumulator.push({
    value: signature,
    path,
    exploitType,
  });
}

function filterJndi(signatures: Array<Signature>) {
  return signatures.filter((signature) => {
    if (isJavaArchive(signature.path)) {
      return true;
    }

    if (signature.path.includes('JndiManager')) {
      const jndiManagerPathIndex = signature.path.indexOf(
        '/net/JndiManager.class',
      );
      const jndiLookupPath =
        signature.path.substr(0, jndiManagerPathIndex) + '/lookup/JndiLookup';

      const isJndiLookupPresent = signatures.find((element) =>
        element.path.includes(jndiLookupPath),
      );

      return !!isJndiLookupPresent;
    }

    return false;
  });
}

function exitWithError() {
  const err = new Error() as any;
  err.code = 'VULNS';

  throw err;
}
