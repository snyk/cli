import { createFromJSON } from '@snyk/dep-graph';

describe('@snyk/dep-graph', () => {
  describe('createFromJSON', () => {
    it('supports percent-encoded plus sign in purl version', () => {
      // Arrange
      const json = {
        schemaVersion: '1.3.0',
        pkgManager: {
          name: 'deb',
          repositories: [
            {
              alias: 'repository:tag',
            },
          ],
        },
        pkgs: [
          {
            id: 'repository@digest',
            info: {
              name: 'repository',
              version: 'digest',
            },
          },
          {
            id: 'db5.3/libdb5.3@5.3.28+dfsg1-0.6ubuntu2',
            info: {
              name: 'db5.3/libdb5.3',
              version: '5.3.28+dfsg1-0.6ubuntu2',
              purl: 'pkg:deb/libdb5.3@5.3.28%2Bdfsg1-0.6ubuntu2?upstream=db5.3',
            },
          },
        ],
        graph: {
          rootNodeId: 'root-node',
          nodes: [
            {
              nodeId: 'root-node',
              pkgId: 'repository@digest',
              deps: [
                {
                  nodeId: 'db5.3/libdb5.3@5.3.28+dfsg1-0.6ubuntu2',
                },
              ],
            },
            {
              nodeId: 'db5.3/libdb5.3@5.3.28+dfsg1-0.6ubuntu2',
              pkgId: 'db5.3/libdb5.3@5.3.28+dfsg1-0.6ubuntu2',
              deps: [],
            },
          ],
        },
      };

      // Act
      createFromJSON(json);
    });
  });
});
