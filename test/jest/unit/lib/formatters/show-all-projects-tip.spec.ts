import { showAllProjectsTip } from '../../../../../src/lib/formatters/show-all-projects-tip';

describe('showAllProjectsTip', () => {
  it('gradle project scanned with --all-sub-projects', () => {
    expect(showAllProjectsTip('gradle', { allSubProjects: true }, 1)).toEqual(
      '',
    );
  });
  it('gradle project scanned without --all-sub-projects with 0 detected extra projects', () => {
    expect(showAllProjectsTip('gradle', {}, 0)).toEqual('');
  });
  it('npm project + detected 8 other projects', () => {
    expect(showAllProjectsTip('npm', {}, 8)).toEqual(
      'Tip: Detected multiple supported manifests (8), use --all-projects to scan all of them at once.',
    );
  });

  it('gradle project + detected 8 other projects', () => {
    expect(showAllProjectsTip('gradle', {}, 8)).toEqual('');
  });
});
