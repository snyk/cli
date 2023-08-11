import * as debugLib from 'debug';
import chalk from 'chalk';

import { MissingConfigurationError } from './errors';
import { makeRequest } from '../../request';
import { Global } from '../../../cli/args';
import { SastSettings } from './types';

declare const global: Global;
const debug = debugLib('snyk-code');

export function isLocalCodeEngine(sastSettings: SastSettings): boolean {
    const { sastEnabled, localCodeEngine } = sastSettings;

    return sastEnabled && localCodeEngine.enabled;
}

export function validateLocalCodeEngineUrl(localCodeEngineUrl: string): void {
    if (localCodeEngineUrl.length === 0) {
        throw new MissingConfigurationError(
            'Snyk Code Local Engine. Refer to our docs on https://docs.snyk.io/products/snyk-code/deployment-options/snyk-code-local-engine/cli-and-ide to learn more',
        );
    }
}

export async function logLocalCodeEngineVersion(lceUrl = ""): Promise<void> {
    const scleBaseUrl = lceUrl.replace('/api', '')

    const ignoreUnknownCAoriginalValue = global.ignoreUnknownCA;
    // `makeRequest` function converts `http` calls to `https`. In some cases, SCLE might be running on http.
    // This problem is fixed by setting `options.rejectUnauthorized = true`.
    // Setting `global.ignoreUnknownCA` to true adds rejectUnauthorized=true as an option in `makeRequest`.
    global.ignoreUnknownCA = true;

    const { res: { body, statusCode } } = await makeRequest({
        url: `${scleBaseUrl}/status`,
        method: 'get'
    })

    // Resetting `global.ignoreUnknownCA` to whatever value it had before I changed it above.
    global.ignoreUnknownCA = ignoreUnknownCAoriginalValue;

    if (body?.ok && body?.version) {
        debug(chalk.green(`Snyk Code Local Engine version: ${body.version}`))
        return;
    }

    if (body?.ok === false) {
        console.log(chalk.red(`Snyk Code Local Engine health check failed. statusCode:${statusCode}, version: ${body?.version}`))
        console.log(chalk.red(`Message: ${JSON.stringify(body?.message)}`))
        return
    }

}