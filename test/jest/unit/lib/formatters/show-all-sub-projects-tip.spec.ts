import { showGradleSubProjectsTip } from '../../../../../src/lib/formatters/show-all-sub-projects-tip';

describe('showAllProjectsTip', () => {
  it('gradle project tested with --gradle-sub-project should show tip', () => {
    expect(
      showGradleSubProjectsTip('gradle', { gradleSubProject: true }, 1),
    ).toEqual(
      'Tip: This project has multiple sub-projects (1), use --all-sub-projects flag to scan all sub-projects.',
    );
  });
  it('gradle project tested with --sub-project should show tip', () => {
    expect(showGradleSubProjectsTip('gradle', { subProject: true }, 1)).toEqual(
      'Tip: This project has multiple sub-projects (1), use --all-sub-projects flag to scan all sub-projects.',
    );
  });

  it('gradle project tested with --all-projects should NOT show tip', () => {
    expect(
      showGradleSubProjectsTip('gradle', { allProjects: true }, 1),
    ).toEqual('');
  });

  it('gradle project scanned with --all-sub-projects should NOT show tip', () => {
    expect(
      showGradleSubProjectsTip('gradle', { allSubProjects: true }, 1),
    ).toEqual('');
  });
  it('gradle project scanned without --all-sub-projects with 0 detected extra projects should NOT show tip', () => {
    expect(showGradleSubProjectsTip('gradle', {}, 0)).toEqual('');
  });
  it('npm project + detected 8 other projects should NOT show tip', () => {
    expect(showGradleSubProjectsTip('npm', {}, 8)).toEqual('');
  });

  it('gradle project + detected 8 other projects should show tip', () => {
    expect(showGradleSubProjectsTip('gradle', {}, 8)).toEqual(
      'Tip: This project has multiple sub-projects (8), use --all-sub-projects flag to scan all sub-projects.',
    );
  });
});
