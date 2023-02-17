import { isUnmanagedEcosystem } from '../../../../../src/lib/ecosystems/common';
import { handleProcessingStatus } from '../../../../../src/lib/polling/common';
import { FailedToRunTestError } from '../../../../../src/lib/errors';
import { formatUnmanagedResults } from '../../../../../src/lib/ecosystems/test';
import * as utils from '../../../../../src/lib/ecosystems/unmanaged/utils';
import { DepGraphDataOpenAPI } from '../../../../../src/lib/ecosystems/unmanaged/types';

describe('isUnmanagedEcosystem fn', () => {
  it.each`
    actual      | expected
    ${'cpp'}    | ${true}
    ${'docker'} | ${false}
    ${'code'}   | ${false}
  `(
    'should validate that given $actual as input, is considered or not an unmanaged ecosystem',
    ({ actual, expected }) => {
      expect(isUnmanagedEcosystem(actual)).toEqual(expected);
    },
  );
});

describe('handleProcessingStatus fn', () => {
  it.each`
    actual         | expected
    ${'CANCELLED'} | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
    ${'ERROR'}     | ${'Failed to process the project. Please run the command again with the `-d` flag and contact support@snyk.io with the contents of the output'}
  `(
    'should validate that given $actual as input, is considered or not an unmanaged ecosystem',
    ({ actual, expected }) => {
      expect(() => {
        handleProcessingStatus({ status: actual } as any);
      }).toThrowError(new FailedToRunTestError(expected));
    },
  );
});

describe('formatUnmanagedResults fn', () => {
  it('should return formatted results', async () => {
    const mockedUnmanagedDepGraph: DepGraphDataOpenAPI = {
      schema_version: '1.2.0',
      pkg_manager: {
        name: 'cpp',
      },
      pkgs: [
        {
          id: 'root-node@0.0.0',
          info: {
            name: 'root-node',
            version: '0.0.0',
          },
        },
        {
          id: 'https://ftp.gnu.org|cpio@2.12',
          info: {
            name: 'https://ftp.gnu.org|cpio',
            version: '2.12',
          },
        },
      ],
      graph: {
        root_node_id: 'root-node',
        nodes: [
          {
            node_id: 'root-node',
            pkg_id: 'root-node@0.0.0',
            deps: [
              {
                node_id: 'https://ftp.gnu.org|cpio@2.12',
              },
            ],
          },
          {
            node_id: 'https://ftp.gnu.org|cpio@2.12',
            pkg_id: 'https://ftp.gnu.org|cpio@2.12',
            deps: [],
          },
        ],
      },
    };
    jest
      .spyOn(utils, 'getUnmanagedDepGraph')
      .mockImplementation(() => Promise.resolve([mockedUnmanagedDepGraph]));

    const { result } = await formatUnmanagedResults({}, 'foo/bar');

    expect(result.includes('DepGraph data:')).toBeTruthy();
    expect(result.includes('DepGraph target:')).toBeTruthy();
    expect(result.includes('foo/bar')).toBeTruthy();
    expect(result.includes('DepGraph end')).toBeTruthy();
  });
});
