export const depGraphData = {
    schemaVersion: '1.2.0',
    pkgManager: { name: 'cpp' },
    pkgs: [
      { id: '_root@0.0.0', info: { name: '_root', version: '0.0.0' } },
      {
        id: 'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
        info: {
          name: 'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip',
          version: '0.5.0',
        },
      },
    ],
    graph: {
      rootNodeId: 'root-node',
      nodes: [
        {
          nodeId: 'root-node',
          pkgId: '_root@0.0.0',
          deps: [
            {
              nodeId:
                'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
            },
          ],
        },
        {
          nodeId:
            'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
          pkgId: 'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
          deps: [],
        },
      ],
    },
  };
  