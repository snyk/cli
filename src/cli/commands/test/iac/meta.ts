import { IacOutputMeta } from '../../../../lib/types';
import { IacOrgSettings } from './local-execution/types';
import * as pathLib from 'path';

export interface GitRepository {
  readonly path: string;

  readRemoteUrl(): Promise<string | undefined>;
}

export interface GitRepositoryFinder {
  findRepositoryForPath(path: string): Promise<GitRepository | undefined>;
}

export async function buildMeta(
  repositoryFinder: GitRepositoryFinder,
  orgSettings: IacOrgSettings,
  projectRoot: string,
  remoteRepoUrl?: string,
  targetName?: string,
): Promise<IacOutputMeta> {
  const gitRemoteUrl = await getGitRemoteUrl(
    repositoryFinder,
    projectRoot,
    remoteRepoUrl,
  );
  const projectName = getProjectName(projectRoot, gitRemoteUrl, targetName);
  const orgName = getOrgName(orgSettings);
  return { projectName, orgName, gitRemoteUrl };
}

function getProjectName(
  projectRoot: string,
  gitRemoteUrl?: string,
  targetName?: string,
): string {
  if (targetName) {
    return targetName;
  }
  if (gitRemoteUrl) {
    return getProjectNameFromGitUrl(gitRemoteUrl);
  }

  return pathLib.basename(pathLib.resolve(projectRoot));
}

function getOrgName(orgSettings: IacOrgSettings): string {
  return orgSettings.meta.org;
}

async function getGitRemoteUrl(
  repositoryFinder: GitRepositoryFinder,
  projectRoot: string,
  remoteRepoUrl?: string,
): Promise<string | undefined> {
  if (remoteRepoUrl) {
    return remoteRepoUrl;
  }

  const repository = await repositoryFinder.findRepositoryForPath(projectRoot);

  if (!repository) {
    return;
  }

  const resolvedRepositoryRoot = pathLib.resolve(repository.path);
  const resolvedProjectRoot = pathLib.resolve(projectRoot);

  if (resolvedRepositoryRoot != resolvedProjectRoot) {
    return;
  }

  return await repository.readRemoteUrl();
}

export function getProjectNameFromGitUrl(url: string) {
  const regexps = [
    /^ssh:\/\/([^@]+@)?[^:/]+(:[^/]+)?\/(?<name>.*).git\/?$/,
    /^(git|https?|ftp):\/\/[^:/]+(:[^/]+)?\/(?<name>.*).git\/?$/,
    /^[^@]+@[^:]+:(?<name>.*).git$/,
    /^(https?):\/\/github.com\/(?<name>.*)$/,
    /^https?:\/\/dev\.azure\.com\/(?<name>[^/]+\/[^/]+\/_git\/[^/]+)/,
    /^https?:\/\/ssh\.dev\.azure\.com\/v3\/(?<name>.*)$/,
    /^git@ssh\.dev\.azure\.com:v3\/(?<name>.*)$/,
  ];

  const trimmed = url.trim();

  for (const regexp of regexps) {
    const match = trimmed.match(regexp);

    if (match?.groups?.name) {
      // Only strip "/_git/" if we are dealing with an Azure url
      if (url.includes('dev.azure.com')) {
        return match.groups.name.replace('/_git/', '/');
      }
      return match.groups.name;
    }
  }

  return trimmed;
}
