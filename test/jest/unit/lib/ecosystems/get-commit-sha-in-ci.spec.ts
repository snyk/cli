import { getCommitSha } from '../../../../../src/lib/ecosystems/get-commit-sha-in-ci';
import { execSync } from 'child_process';

jest.mock('child_process');

describe('getCommitSha', () => {
  const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clear all CI-related environment variables
    Object.keys(process.env).forEach((key) => {
      if (
        key.includes('COMMIT') ||
        key.includes('SHA') ||
        key.includes('GIT') ||
        key.includes('REVISION')
      ) {
        delete process.env[key];
      }
    });
    jest.clearAllMocks();
    // Suppress console.warn during tests
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('Environment variable detection', () => {
    it('should return SHA from SNYK_GIT_SHA when set', () => {
      process.env.SNYK_GIT_SHA = 'abc123def456abc123def456abc123def456abc1';
      expect(getCommitSha()).toBe('abc123def456abc123def456abc123def456abc1');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should return SHA from GITHUB_SHA when set', () => {
      process.env.GITHUB_SHA = '1234567890abcdef1234567890abcdef12345678';
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should return SHA from CI_COMMIT_SHA (GitLab) when set', () => {
      process.env.CI_COMMIT_SHA = 'fedcba0987654321fedcba0987654321fedcba09';
      expect(getCommitSha()).toBe('fedcba0987654321fedcba0987654321fedcba09');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should return SHA from TRAVIS_COMMIT when set', () => {
      process.env.TRAVIS_COMMIT = 'abcdef1234567890abcdef1234567890abcdef12';
      expect(getCommitSha()).toBe('abcdef1234567890abcdef1234567890abcdef12');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should return SHA from CIRCLE_SHA1 (CircleCI) when set', () => {
      process.env.CIRCLE_SHA1 = '9876543210fedcba9876543210fedcba98765432';
      expect(getCommitSha()).toBe('9876543210fedcba9876543210fedcba98765432');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should return SHA from GIT_COMMIT (Jenkins) when set', () => {
      process.env.GIT_COMMIT = 'aabbccddaabbccddaabbccddaabbccddaabbccdd';
      expect(getCommitSha()).toBe('aabbccddaabbccddaabbccddaabbccddaabbccdd');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should prioritize SNYK_GIT_SHA over other environment variables', () => {
      process.env.SNYK_GIT_SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      process.env.GITHUB_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      process.env.CI_COMMIT_SHA = 'cccccccccccccccccccccccccccccccccccccccc';
      expect(getCommitSha()).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should accept short SHA (7 characters minimum)', () => {
      process.env.GITHUB_SHA = 'abc1234';
      expect(getCommitSha()).toBe('abc1234');
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should accept SHA with mixed case', () => {
      process.env.GITHUB_SHA = 'AbCdEf1234567890AbCdEf1234567890AbCdEf12';
      expect(getCommitSha()).toBe('AbCdEf1234567890AbCdEf1234567890AbCdEf12');
      expect(mockExecSync).not.toHaveBeenCalled();
    });
  });

  describe('Environment variable validation', () => {
    it('should reject SHA that is too short (less than 7 characters)', () => {
      process.env.GITHUB_SHA = 'abc123';
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should reject SHA that is too long (more than 40 characters)', () => {
      process.env.GITHUB_SHA =
        'abc123def456abc123def456abc123def456abc123extra';
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should reject SHA with non-hexadecimal characters', () => {
      process.env.GITHUB_SHA = 'xyz123def456abc123def456abc123def456abc1';
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should reject empty string', () => {
      process.env.GITHUB_SHA = '';
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalled();
    });
  });

  describe('Git command fallback', () => {
    it('should execute git command when no environment variable is set', () => {
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalledWith('git rev-parse HEAD', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      });
    });

    it('should trim whitespace from git command output', () => {
      mockExecSync.mockReturnValue(
        '  1234567890abcdef1234567890abcdef12345678  \n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
    });

    it('should return null when git command fails', () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('Command failed: git rev-parse HEAD');
      });
      expect(getCommitSha()).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to determine commit SHA'),
      );
    });

    it('should return null when git command returns invalid SHA', () => {
      mockExecSync.mockReturnValue('not-a-valid-sha\n' as any);
      expect(getCommitSha()).toBeNull();
    });

    it('should return null when git command returns short SHA (not 40 chars)', () => {
      mockExecSync.mockReturnValue('abc1234\n' as any);
      expect(getCommitSha()).toBeNull();
    });

    it('should handle non-Error exceptions from git command', () => {
      mockExecSync.mockImplementation(() => {
        throw 'String error';
      });
      expect(getCommitSha()).toBeNull();
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('String error'),
      );
    });

    it('should warn with error message when git command fails', () => {
      const errorMessage = 'fatal: not a git repository';
      mockExecSync.mockImplementation(() => {
        throw new Error(errorMessage);
      });
      getCommitSha();
      expect(console.warn).toHaveBeenCalledWith(
        `Warning: Failed to determine commit SHA via git command: ${errorMessage}`,
      );
    });
  });

  describe('Priority and fallback behavior', () => {
    it('should not call git command if valid environment variable exists', () => {
      process.env.GITHUB_SHA = '1234567890abcdef1234567890abcdef12345678';
      getCommitSha();
      expect(mockExecSync).not.toHaveBeenCalled();
    });

    it('should try git command if all environment variables are invalid', () => {
      process.env.GITHUB_SHA = 'invalid';
      process.env.CI_COMMIT_SHA = 'also-invalid';
      mockExecSync.mockReturnValue(
        '1234567890abcdef1234567890abcdef12345678\n' as any,
      );
      expect(getCommitSha()).toBe('1234567890abcdef1234567890abcdef12345678');
      expect(mockExecSync).toHaveBeenCalled();
    });

    it('should return first valid environment variable in priority order', () => {
      process.env.BUILDKITE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      process.env.GITHUB_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      // GITHUB_SHA should be returned as it has higher priority
      expect(getCommitSha()).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    });
  });

  describe('Real-world CI platform scenarios', () => {
    it('should handle AWS CodeBuild environment', () => {
      process.env.CODEBUILD_RESOLVED_SOURCE_VERSION =
        'abc123def456abc123def456abc123def456abc1';
      expect(getCommitSha()).toBe('abc123def456abc123def456abc123def456abc1');
    });

    it('should handle Azure DevOps environment', () => {
      process.env.BUILD_SOURCEVERSION =
        'def456abc123def456abc123def456abc123def4';
      expect(getCommitSha()).toBe('def456abc123def456abc123def456abc123def4');
    });

    it('should handle Bitbucket Pipelines environment', () => {
      process.env.BITBUCKET_COMMIT = 'fedcba9876543210fedcba9876543210fedcba98';
      expect(getCommitSha()).toBe('fedcba9876543210fedcba9876543210fedcba98');
    });

    it('should handle Google Cloud Build with COMMIT_SHA', () => {
      process.env.COMMIT_SHA = '1111222233334444555566667777888899990000';
      expect(getCommitSha()).toBe('1111222233334444555566667777888899990000');
    });

    it('should handle Google Cloud Build with REVISION_ID', () => {
      process.env.REVISION_ID = '0000999988887777666655554444333322221111';
      expect(getCommitSha()).toBe('0000999988887777666655554444333322221111');
    });
  });
});
