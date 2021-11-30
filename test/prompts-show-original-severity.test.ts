import fs from 'fs';
import { test } from 'tap';
import path from 'path';
import { getPrompts } from '../src/cli/commands/protect/prompts';

test('wizard prompts should show original severity', async (t) => {
  const id = 'npm:node-uuid:20160328';
  const vulnsJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './fixtures/original-severity-vulns.json'),
      'utf-8',
    ),
  );

  const { vulnerabilities, policy } = vulnsJson;

  try {
    const allPrompts = getPrompts(vulnerabilities, policy);

    const prompt = allPrompts
      .filter((p) => {
        return p.name.indexOf(id) === 0;
      })
      .shift();

    t.match(
      prompt?.message,
      'Low (originally Medium) severity vuln found in node-uuid@1.4.0, introduced via node-uuid@1.4.0',
    );
  } catch (e) {
    t.threw(e);
  }
});

test('wizard prompts should not show original severity if its the same', async (t) => {
  const id = 'npm:node-uuid:20160328';
  const vulnsJson = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, './fixtures/original-severity-vulns.json'),
      'utf-8',
    ),
  );

  const { vulnerabilities, policy } = vulnsJson;

  vulnerabilities[0].originalSeverity = 'low';

  try {
    const allPrompts = getPrompts(vulnerabilities, policy);

    const prompt = allPrompts
      .filter((p) => {
        return p.name.indexOf(id) === 0;
      })
      .shift();

    t.match(
      prompt?.message,
      'Low severity vuln found in node-uuid@1.4.0, introduced via node-uuid@1.4.0',
    );
  } catch (e) {
    t.threw(e);
  }
});
