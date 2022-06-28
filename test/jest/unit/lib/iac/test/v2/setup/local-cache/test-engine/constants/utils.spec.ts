import * as os from 'os';
import { formatTestEngineFileName } from '../../../../../../../../../../../src/lib/iac/test/v2/setup/local-cache/test-engine/constants/utils';

describe('formatTestEngineFileName', () => {
  const testReleaseVersion = '6.6.6';

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each`
    osPlatform              | osArch              | expectedFileName
    ${'darwin'}             | ${'arm64'}          | ${`snyk-iac-test_${testReleaseVersion}_Darwin_arm64`}
    ${'darwin'}             | ${'any-other-arch'} | ${`snyk-iac-test_${testReleaseVersion}_Darwin_x86_64`}
    ${'win32'}              | ${'arm64'}          | ${`snyk-iac-test_${testReleaseVersion}_Windows_arm64.exe`}
    ${'win32'}              | ${'any-other-arch'} | ${`snyk-iac-test_${testReleaseVersion}_Windows_x86_64.exe`}
    ${'any-other-platform'} | ${'arm64'}          | ${`snyk-iac-test_${testReleaseVersion}_Linux_arm64`}
    ${'any-other-platform'} | ${'any-other-arch'} | ${`snyk-iac-test_${testReleaseVersion}_Linux_x86_64`}
  `(
    'with `$osPlatform` platform and `$osArch` architecture',
    ({ osPlatform, osArch, expectedFileName }) => {
      it(`returns ${expectedFileName}`, () => {
        // Arrange
        jest.spyOn(os, 'platform').mockImplementation(() => osPlatform);
        jest.spyOn(os, 'arch').mockImplementation(() => osArch);

        // Act
        const res = formatTestEngineFileName(testReleaseVersion);

        // Assert
        expect(res).toEqual(expectedFileName);
      });
    },
  );
});
