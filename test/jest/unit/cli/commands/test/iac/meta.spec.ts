import {
  buildMeta,
  getProjectNameFromGitUrl,
} from '../../../../../../../src/cli/commands/test/iac/meta';
import * as path from 'path';

describe('buildMeta', () => {
  describe('current directory is a repository with a URL', () => {
    const orgName = 'org';
    const orgSettings = orgSettingsFor(orgName);
    const repoPath = path.resolve('project');
    const repoUrl = 'git@example.com:foo/bar.git';
    const repoFinder = repositoryFound(repoPath, repoUrl);

    it('should return a valid meta', async () => {
      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        repoPath,
        undefined,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'foo/bar',
        orgName: orgName,
        gitRemoteUrl: repoUrl,
      });
    });

    it('should respect the repository URL override', async () => {
      const repoUrl = 'git@example.com:baz/qux.git';

      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        repoPath,
        repoUrl,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'baz/qux',
        orgName: 'org',
        gitRemoteUrl: repoUrl,
      });
    });
  });

  describe('current directory is a repository without a URL', () => {
    const orgName = 'org';
    const orgSettings = orgSettingsFor(orgName);
    const repoPath = path.resolve('project');
    const repoFinder = repositoryFound(repoPath);

    it('should return a valid meta', async () => {
      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        repoPath,
        undefined,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'project',
        orgName: orgName,
        gitRemoteUrl: undefined,
      });
    });

    it('should respect the repository URL override', async () => {
      const repoUrl = 'git@example.com:baz/qux.git';

      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        repoPath,
        repoUrl,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'baz/qux',
        orgName: 'org',
        gitRemoteUrl: repoUrl,
      });
    });
  });

  describe('current directory is not a repository', () => {
    const orgName = 'org';
    const orgSettings = orgSettingsFor(orgName);
    const repoFinder = repositoryNotFound();
    const projectPath = path.resolve('project');

    it('should return a valid meta', async () => {
      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        projectPath,
        undefined,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'project',
        orgName: orgName,
        gitRemoteUrl: undefined,
      });
    });

    it('should respect the repository URL override', async () => {
      const repoUrl = 'git@example.com:baz/qux.git';

      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        projectPath,
        repoUrl,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'baz/qux',
        orgName: 'org',
        gitRemoteUrl: repoUrl,
      });
    });

    it('should respect the target-name override over the remote-repo-url for the project name', async () => {
      const repoUrl = 'git@example.com:baz/qux.git';
      const targetName = 'fab-tf-project';

      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        projectPath,
        repoUrl,
        targetName,
      );

      expect(meta).toMatchObject({
        projectName: targetName,
        orgName: 'org',
        gitRemoteUrl: repoUrl,
      });
    });
  });

  describe('parent directory is a repository with a URL', () => {
    const orgName = 'org';
    const orgSettings = orgSettingsFor(orgName);
    const projectPath = path.resolve('project');
    const repoPath = path.resolve('.');
    const repoUrl = 'git@example.com:foo/bar.git';
    const repoFinder = repositoryFound(repoPath, repoUrl);

    it('should return a valid meta', async () => {
      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        projectPath,
        undefined,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'project',
        orgName: orgName,
        gitRemoteUrl: undefined,
      });
    });

    it('should respect the repository URL override', async () => {
      const repoUrl = 'git@example.com:baz/qux.git';

      const meta = await buildMeta(
        repoFinder,
        orgSettings,
        repoPath,
        repoUrl,
        undefined,
      );

      expect(meta).toMatchObject({
        projectName: 'baz/qux',
        orgName: 'org',
        gitRemoteUrl: repoUrl,
      });
    });
  });
});

describe('getProjectNameFromGitUrl', () => {
  const urls = [
    // SSH URLs without ~username expansion, as documented by "git clone".

    'ssh://user@host.xz:1234/user/repo.git/',
    'ssh://host.xz:1234/user/repo.git/',
    'ssh://user@host.xz/user/repo.git/',
    'ssh://host.xz/user/repo.git/',
    'ssh://user@host.xz:1234/user/repo.git',
    'ssh://host.xz:1234/user/repo.git',
    'ssh://user@host.xz/user/repo.git',
    'ssh://host.xz/user/repo.git',

    // Git URLs without ~username expansion, as documented by "git clone".

    'git://host.xz:1234/user/repo.git/',
    'git://host.xz/user/repo.git/',
    'git://host.xz:1234/user/repo.git',
    'git://host.xz/user/repo.git',

    // HTTP URLs, as documented by "git clone".

    'http://host.xz:1234/user/repo.git/',
    'http://host.xz/user/repo.git/',
    'http://host.xz:1234/user/repo.git',
    'http://host.xz/user/repo.git',

    // HTTPS URLs, as documented by "git clone".

    'https://host.xz:1234/user/repo.git/',
    'https://host.xz/user/repo.git/',
    'https://host.xz:1234/user/repo.git',
    'https://host.xz/user/repo.git',

    // SSH URLs without protocol, as used by GitHub.

    'git@github.com:user/repo.git',

    // If everything else fails, the URL should be returned as-is, but trimmed.

    'user/repo',
    ' user/repo',
    'user/repo ',
  ];

  it.each(urls)('should parse %s', (url) => {
    expect(getProjectNameFromGitUrl(url)).toBe('user/repo');
  });
});

function orgSettingsFor(org) {
  return {
    customPolicies: {},
    meta: {
      isPrivate: false,
      isLicensesEnabled: false,
      org,
    },
  };
}

function repositoryNotFound() {
  return {
    async findRepositoryForPath() {
      return undefined;
    },
  };
}

function repositoryFound(path: string, url?: string) {
  const repository = {
    path,

    async readRemoteUrl() {
      return url;
    },
  };

  return {
    async findRepositoryForPath() {
      return repository;
    },
  };
}
