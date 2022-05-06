import * as pathLib from 'path';
import { getDisplayPath } from '../../../../../../src/cli/commands/fix/get-display-path';

const projectDirectoryName = pathLib.basename(
  pathLib.resolve(__dirname, '..', '..', '..', '..', '..', '..'),
);

describe('getDisplayPath', () => {
  it('paths that do not exist on disk returned as is', () => {
    const displayPath = getDisplayPath('semver@2.3.1');
    expect(displayPath).toEqual('semver@2.3.1');
  });
  it('current path is displayed as .', () => {
    const displayPath = getDisplayPath(process.cwd());
    expect(displayPath).toEqual(projectDirectoryName);
  });
  it('a local path is returned as relative path to current dir', () => {
    const displayPath = getDisplayPath(`test${pathLib.sep}fixtures`);
    expect(displayPath).toEqual(`test${pathLib.sep}fixtures`);
  });
  it('a local full path is returned as relative path to current dir', () => {
    const displayPath = getDisplayPath(
      pathLib.resolve(process.cwd(), 'test', 'fixtures'),
    );
    expect(displayPath).toEqual(`test${pathLib.sep}fixtures`);
  });
});
