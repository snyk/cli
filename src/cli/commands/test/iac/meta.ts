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
  ];

  const trimmed = url.trim();

  for (const regexp of regexps) {
    const match = trimmed.match(regexp);

    if (match && match.groups) {
      return match.groups.name;
    }
  }

  return trimmed;
}
