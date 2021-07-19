/* eslint-disable @typescript-eslint/camelcase */
export const scanResults = {
    path: [
      {
        name: 'my-unmanaged-c-project',
        facts: [
          {
            type: 'fileSignatures',
            data: [
              {
                path: 'fastlz_example/fastlz.h',
                hashes_ffm: [
                  {
                    format: 1,
                    data: 'ucMc383nMM/wkFRM4iOo5Q',
                  },
                  {
                    format: 1,
                    data: 'k+DxEmslFQWuJsZFXvSoYw',
                  },
                ],
              },
            ],
          },
        ],
        identity: {
          type: 'cpp',
        },
        target: {
          remoteUrl: 'https://github.com/some-org/some-unmanaged-project.git',
          branch: 'master',
        },
      },
    ],
  };