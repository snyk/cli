import { loadPlugin } from '../../../../src/plugins/load-plugin';
import { nodeFix } from '../../../../src/plugins/node';

// Mock the node fix module
jest.mock('../../../../src/plugins/node', () => ({
  nodeFix: jest.fn(),
}));

describe('loadPlugin - npm support', () => {
  it('should return nodeFix handler for npm type', () => {
    const handler = loadPlugin('npm');
    expect(handler).toBe(nodeFix);
  });

  it('should throw UnsupportedTypeError for unknown types', () => {
    expect(() => loadPlugin('unknown-package-manager')).toThrow(
      'Provided scan type is not supported',
    );
  });
});

