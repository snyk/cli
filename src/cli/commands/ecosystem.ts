import * as process from 'process';

import * as Debug from 'debug';
const debug = Debug('snyk');

import { getSinglePluginResult } from '../../lib/plugins/get-single-plugin-result';
import { detectPackageManager } from '../../lib/detect';

/**
 * ecosystem provides an entrypoint for driving legacy Snyk SCA ecosystem modules.
 *
 * This is not a public-facing subcommand, but a means by which the Go CLI can
 * drive and orchestrate legacy Typescript ecosystem modules. As such, it is
 * undocumented and comes with no guarantees of compatibility. It should be
 * regarded as entirely internal to the CLI.
 *
 * Command line arguments are parsed. This command reads a pre-created
 * options JSON object from stdin, loads the appropriate ecosystem module, and
 * executes it to produce a dependency graph which is then writen to standard
 * output.
 *
 * If an exception is thrown, an object with the key `error` is produced.
 *
 * Example usage, to illustrate:
 *
 *     snyk ecosystem <<<'{"file": "package.json", "path": "/Users/c/Projects/cli", "showVulnPaths": "some"}'
 *     { ... (JSON output written to stdout) ... }
 *
 */
export default async function ecosystem(): Promise<void> {
  try {
    const options: any = JSON.parse(await readStdin());
    debug('snyk ecosystem called with options: %O', options);

    const root = options.path ?? process.cwd();
    options.packageManager = detectPackageManager(root, options);

    const res = await getSinglePluginResult(root, options);
    console.log(JSON.stringify(res));
  } catch (err) {
    debug('snyk ecosystem failed with error: %O', err);
    console.log(JSON.stringify({error: err}));
  }
}

async function readStdin(): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
