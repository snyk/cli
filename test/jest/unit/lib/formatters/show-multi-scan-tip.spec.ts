import { showMultiScanTip } from '../../../../../src/lib/formatters/show-multi-scan-tip';

describe('showMultiScanTip', () => {
  it('gradle project tested with --gradle-sub-project should show gradle tip', () => {
    expect(
      showMultiScanTip(
        'gradle',
        { gradleSubProject: true, path: 'src', showVulnPaths: 'none' },
        1,
      ),
    ).toEqual(
      'Tip: This project has multiple sub-projects (1), use --all-sub-projects flag to scan all sub-projects.',
    );
  });

  it('npm project should show --all-projects tip', () => {
    expect(
      showMultiScanTip(
        'npm',
        { gradleSubProject: true, path: 'src', showVulnPaths: 'none' },
        8,
      ),
    ).toEqual(
      'Tip: Detected multiple supported manifests (8), use --all-projects to scan all of them at once.',
    );
  });

  it('gradle scan with --all-sub-projects should NOT show tip', () => {
    expect(
      showMultiScanTip(
        'gradle',
        { allSubProjects: true, path: 'src', showVulnPaths: 'none' },
        1,
      ),
    ).toEqual('');
  });

  it('npm scan with --all-projects should NOT show tip', () => {
    expect(
      showMultiScanTip(
        'npm',
        { allProjects: true, path: 'src', showVulnPaths: 'none' },
        1,
      ),
    ).toEqual('');
  });

  it('maven without options and more than 1 file detected shows tip', () => {
    expect(
      showMultiScanTip('maven', { path: 'src', showVulnPaths: 'none' }, 2),
    ).toMatch('Tip: Detected Maven project, are you using modules?');
  });
});
