import { DepGraphBuilder } from '@snyk/dep-graph';
import { hasUnknownVersions } from '../../../src/lib/dep-graph';

describe('dep-graph', () => {
  describe('hasUnknownVersions', () => {
    it('returns true when dep-graph has unknown versions', () => {
      const builder = new DepGraphBuilder({ name: 'maven' });
      builder.addPkgNode({ name: 'test', version: 'unknown' }, 'test@unknown');
      builder.connectDep(builder.rootNodeId, 'test@unknown');
      const depGraph = builder.build();
      const received = hasUnknownVersions(depGraph);
      expect(received).toBe(true);
    });
    it('returns false when dep-graph does not have unknown versions', () => {
      const builder = new DepGraphBuilder({ name: 'maven' });
      builder.addPkgNode({ name: 'test', version: '1.2.3' }, 'test@1.2.3');
      builder.connectDep(builder.rootNodeId, 'test@1.2.3');
      const depGraph = builder.build();
      const received = hasUnknownVersions(depGraph);
      expect(received).toBe(false);
    });
    it('returns false when dep-graph is undefined', () => {
      const received = hasUnknownVersions(undefined);
      expect(received).toBe(false);
    });
  });
});
