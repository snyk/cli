import * as path from 'path';
import * as fs from 'fs';

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

async function processMarkdown(markdownDoc, commandName) {
  const markdownFilePath = path.resolve(MARKDOWN_DIR, `${commandName}.md`);

  fs.writeFileSync(markdownFilePath, markdownDoc);
}

export async function generateHelp() {
  const getMdFilePath = (filename: string) =>
    path.resolve(__dirname, `./../commands-docs/${filename}.md`);

  const readFile = (filename: string) =>
    fs.readFileSync(getMdFilePath(filename), 'utf8');

  const readFileIfExists = (filename: string) =>
    fs.existsSync(getMdFilePath(filename)) ? readFile(filename) : '';

  const _snykGlobalOptions = readFile('_SNYK_GLOBAL_OPTIONS');
  const _environment = readFile('_ENVIRONMENT');
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
}

generateHelp();
