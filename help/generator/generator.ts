import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

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
  config: {},
  protect: {},
  policy: {},
  ignore: {},
  wizard: {},
  help: {},
  woof: {},
};

const GENERATED_MARKDOWN_FOLDER = './help/commands-md';
const GENERATED_MAN_FOLDER = './help/commands-man';
const GENERATED_TXT_FOLDER = './help/commands-docs';

function execShellCommand(cmd): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.warn(error);
      }
      return resolve(stdout ? stdout : stderr);
    });
  });
}

async function generateRoff(inputFile): Promise<string> {
  return await execShellCommand(
    `cat ${inputFile} | ${RONN_COMMAND} --roff --pipe --organization=Snyk.io`,
  );
}

async function printRoff2Txt(inputFile) {
  return await execShellCommand(`cat ${inputFile} | ${RONN_COMMAND} -m`);
}

async function processMarkdown(markdownDoc, commandName) {
  const markdownFilePath = `${GENERATED_MARKDOWN_FOLDER}/${commandName}.md`;
  const roffFilePath = `${GENERATED_MAN_FOLDER}/${commandName}.1`;
  const txtFilePath = `${GENERATED_TXT_FOLDER}/${commandName}.txt`;

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
  console.log(formattedTxtDoc);

  fs.writeFileSync(txtFilePath, formattedTxtDoc);
}

async function run() {
  // Ensure folders exists
  [
    GENERATED_MAN_FOLDER,
    GENERATED_MARKDOWN_FOLDER,
    GENERATED_TXT_FOLDER,
  ].forEach((path) => {
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
