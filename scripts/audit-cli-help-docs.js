#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const helpDir = path.join(repoRoot, 'help', 'cli-commands');
const failOnMissing = process.argv.includes('--fail-on-missing');
const includeHidden = process.argv.includes('--include-hidden');
const includeInternal = process.argv.includes('--include-internal');

const internalCommands = new Set([
  'datatransformation',
  'filter',
  'help',
  'internal cleanup',
  'legacycli',
  'output',
  'reportanalytics',
]);

function readFile(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function expectedHelpFile(command) {
  return `${command.replace(/\s+/g, '-')}.md`;
}

function addCommand(commands, command, source, visible = true) {
  const normalizedCommand = command.trim().replace(/\s+/g, ' ');
  if (!normalizedCommand) {
    return;
  }

  if (!commands.has(normalizedCommand)) {
    commands.set(normalizedCommand, {
      command: normalizedCommand,
      sources: new Set(),
      visible,
    });
  }

  const entry = commands.get(normalizedCommand);
  entry.sources.add(source);
  entry.visible = entry.visible || visible;
}

function legacyCommands() {
  const commands = new Map();
  const commandIndex = readFile('src/cli/commands/index.js');

  for (const match of commandIndex.matchAll(
    /^\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z][\w-]*)):\s*async/gm,
  )) {
    addCommand(commands, match[1] || match[2] || match[3], 'legacy command');
  }

  const modes = readFile('src/cli/modes.ts');
  for (const match of modes.matchAll(
    /^\s{2}([a-zA-Z][\w-]*):\s*{\s*allowedCommands:\s*\[([^\]]*)\]/gm,
  )) {
    const mode = match[1];
    const allowedCommands = Array.from(
      match[2].matchAll(/'([^']+)'|"([^"]+)"/g),
      (allowedCommandMatch) => allowedCommandMatch[1] || allowedCommandMatch[2],
    );

    addCommand(commands, mode, 'legacy mode');
    for (const allowedCommand of allowedCommands) {
      addCommand(commands, `${mode} ${allowedCommand}`, 'legacy mode');
    }
  }

  return commands;
}

function nativeCommands() {
  const result = spawnSync(
    'go',
    [
      'test',
      './pkg/core',
      '-run',
      'TestPrintRegisteredCommandTreeForHelpAudit',
      '-count=1',
      '-v',
    ],
    {
      cwd: path.join(repoRoot, 'cliv2'),
      encoding: 'utf8',
      env: {
        ...process.env,
        SNYK_HELP_AUDIT_PRINT_COMMANDS: '1',
      },
    },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }

  const match = result.stdout.match(/SNYK_HELP_AUDIT_COMMANDS=(\[.*\])/);
  if (!match) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error('Could not find registered command audit output.');
  }

  return JSON.parse(match[1]);
}

function helpFiles() {
  return new Set(
    fs
      .readdirSync(helpDir)
      .filter(
        (fileName) => fileName.endsWith('.md') && fileName !== 'README.md',
      ),
  );
}

function collectCommands() {
  const commands = legacyCommands();

  for (const nativeCommand of nativeCommands()) {
    addCommand(
      commands,
      nativeCommand.command,
      nativeCommand.visible ? 'native workflow' : 'native workflow hidden',
      nativeCommand.visible,
    );
  }

  return Array.from(commands.values()).map((entry) => ({
    ...entry,
    sources: Array.from(entry.sources).sort(),
  }));
}

const docs = helpFiles();
const missing = collectCommands()
  .filter((entry) => includeInternal || !internalCommands.has(entry.command))
  .filter((entry) => includeHidden || entry.visible)
  .filter((entry) => !docs.has(expectedHelpFile(entry.command)))
  .sort((a, b) => a.command.localeCompare(b.command));

if (missing.length === 0) {
  console.log('All discovered CLI commands have help docs.');
  process.exit(0);
}

console.log('CLI commands without help docs:');
for (const entry of missing) {
  console.log(
    `- snyk ${entry.command} -> help/cli-commands/${expectedHelpFile(
      entry.command,
    )} (${entry.sources.join(', ')})`,
  );
}

if (failOnMissing) {
  process.exit(1);
}
