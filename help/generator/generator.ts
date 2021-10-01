import * as path from 'path';
import * as fs from 'fs';
import { runCommand } from '../../test/jest/util/runCommand';

const RONN_COMMAND = process.env.RONN_COMMAND || 'ronn';
const COMMANDS: Record<string, { optionsFile?: string }> = {
  auth: {},
  test: {
    optionsFile: '_SNYK_COMMAND_OPTIONS',
  },
  monitor: {
    optionsFile: '_SNYK_COMMAND_OPTIONS',
  },
  container: {},
  iac: {},
  code: {},
  config: {},
  protect: {},
  policy: {},
  ignore: {},
  wizard: {},
  help: {},
  woof: {},
};

const MARKDOWN_DIR = path.resolve(__dirname, '../commands-md');
const MAN_DIR = path.resolve(__dirname, '../commands-man');
const TXT_DIR = path.resolve(__dirname, '../commands-txt');

async function execShellCommand(cmd: string, args: string[]): Promise<string> {
  const { code, stdout, stderr } = await runCommand(cmd, args, {
    env: {
      ...process.env,
      PAGER: 'more', // see https://github.com/apjanke/ronn-ng/issues/71
    },
  });
  if (stderr) {
    console.error(stderr);
  }
  if (code !== 0) {
    throw new Error('Command exiting with non-zero exit code.');
  }
  return stdout;
}

async function generateRoff(inputFile): Promise<string> {
  return await execShellCommand(RONN_COMMAND, [
    '--roff',
    '--pipe',
    '--organization=Snyk.io',
    inputFile,
  ]);
}

async function printRoff2Txt(inputFile): Promise<string> {
  return await execShellCommand(RONN_COMMAND, ['-m', inputFile]);
}

async function processMarkdown(markdownDoc, commandName) {
  const markdownFilePath = path.resolve(MARKDOWN_DIR, `${commandName}.md`);
  const roffFilePath = path.resolve(MAN_DIR, `${commandName}.1`);
  const txtFilePath = path.resolve(TXT_DIR, `${commandName}.txt`);

  console.info(`Generating markdown version ${commandName}.md`);
  fs.writeFileSync(markdownFilePath, markdownDoc);

  console.info(`Generating roff version ${commandName}.1`);
  const roffDoc = await generateRoff(markdownFilePath);

  fs.writeFileSync(roffFilePath, roffDoc);

  console.info(`Generating txt version ${commandName}.txt`);
  const txtDoc = (await printRoff2Txt(markdownFilePath)) as string;

  const formattedTxtDoc = txtDoc
    .replace(/(.)[\b](.)/gi, (match, firstChar, actualletter) => {
      if (firstChar === '_' && actualletter !== '_') {
        return `\x1b[4m${actualletter}\x1b[0m`;
      }
      return `\x1b[1m${actualletter}\x1b[0m`;
    })
    .split('\n')
    .slice(4, -4)
    .join('\n');

  fs.writeFileSync(txtFilePath, formattedTxtDoc);
}

async function run() {
  // Ensure folders exists
  [MAN_DIR, MARKDOWN_DIR, TXT_DIR].forEach((path) => {
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }
  });

  const getMdFilePath = (filename: string) =>
    path.resolve(__dirname, `./../commands-docs/${filename}.md`);

  const readFile = (filename: string) =>
    fs.readFileSync(getMdFilePath(filename), 'utf8');

  const readFileIfExists = (filename: string) =>
    fs.existsSync(getMdFilePath(filename)) ? readFile(filename) : '';

  const _snykHeader = readFile('_SNYK_COMMAND_HEADER');
  const _snykOptions = readFile('_SNYK_COMMAND_OPTIONS');
  const _snykGlobalOptions = readFile('_SNYK_GLOBAL_OPTIONS');
  const _environment = readFile('_ENVIRONMENT');
  const _examples = readFile('_EXAMPLES');
  const _exitCodes = readFile('_EXIT_CODES');
  const _notices = readFile('_NOTICES');

  for (const [name, { optionsFile }] of Object.entries(COMMANDS)) {
    const commandDoc = readFile(name);

    // Piece together a help file for each command
    const doc = `${commandDoc}

${optionsFile ? readFileIfExists(optionsFile) : ''}

${_snykGlobalOptions}

${readFileIfExists(`${name}-examples`)}

${_exitCodes}

${_environment}

${_notices}
`;

    await processMarkdown(doc, 'snyk-' + name);
  }

  // This just slaps strings together for the global snyk help doc
  const globalDoc = `${_snykHeader}

${_snykOptions}
${_snykGlobalOptions}

${_examples}

${_exitCodes}

${_environment}

${_notices}
`;
  await processMarkdown(globalDoc, 'snyk');
}
run();
