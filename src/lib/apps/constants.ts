import chalk from 'chalk';

export const SNYK_APP_NAME = 'snykAppName';
export const SNYK_APP_REDIRECT_URIS = 'snykAppRedirectUris';
export const SNYK_APP_SCOPES = 'snykAppScopes';
export const SNYK_APP_CLIENT_ID = 'snykAppClientId';
export const SNYK_APP_ORG_ID = 'snykAppOrgId';
export const SNYK_APP_CONTEXT = 'context';
export const SNYK_APP_DEBUG = 'snyk:apps';

export enum EValidSubCommands {
  CREATE = 'create',
}

export enum EAppsURL {
  CREATE_APP,
}

export const validAppsSubCommands = Object.values<string>(EValidSubCommands);

export const AppsErrorMessages = {
  orgRequired: `Option '--org' is required! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.`,
  nameRequired: `Option '--name' is required! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.`,
  redirectUrisRequired: `Option '--redirect-uris' is required! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.`,
  scopesRequired: `Option '--scopes' is required! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.`,
  invalidContext: `Option '--context' must be either 'tenant' or 'user'! For interactive mode, please use '--interactive' or '-i' flag. For more information please run the help command 'snyk apps --help' or 'snyk apps -h'.`,
  useExperimental: `\n${chalk.redBright(
    "All 'apps' commands are only accessible behind the '--experimental' flag.",
  )}\n
The behaviour can change at any time, without prior notice.
You are kindly advised to use all the commands with caution.

${chalk.bold('Usage')}
  ${chalk.italic('snyk apps <COMMAND> --experimental')}\n`,
};

export const CreateAppPromptData = {
  SNYK_APP_NAME: {
    name: SNYK_APP_NAME,
    message: `Name of the Snyk App (visible to users when they install the Snyk App)?`,
  },
  SNYK_APP_REDIRECT_URIS: {
    name: SNYK_APP_REDIRECT_URIS,
    message: `Your Snyk App's redirect URIs (comma seprated list. ${chalk.yellowBright(
      ' Ex: https://example1.com,https://example2.com',
    )})?: `,
  },
  SNYK_APP_SCOPES: {
    name: SNYK_APP_SCOPES,
    message: `Your Snyk App's permission scopes (comma separated list. ${chalk.yellowBright(
      ' Ex: org.read,org.report.read',
    )})?: `,
  },
  SNYK_APP_ORG_ID: {
    name: SNYK_APP_ORG_ID,
    message:
      'Please provide the org id under which you want to create your Snyk App: ',
  },
  SNYK_APP_CONTEXT: {
    name: SNYK_APP_CONTEXT,
    message: 'Which context will your app operate under: ',
  },
};
