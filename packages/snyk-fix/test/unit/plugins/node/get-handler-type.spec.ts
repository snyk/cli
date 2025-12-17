import { getHandlerType } from '../../../../src/plugins/node/get-handler-type';
import { SUPPORTED_HANDLER_TYPES } from '../../../../src/plugins/node/supported-handler-types';
import { EntityToFix } from '../../../../src/types';

describe('getHandlerType', () => {
  function createMockEntity(targetFile: string | undefined, packageManager?: string): EntityToFix {
    return {
      workspace: {
        path: '/test/project',
        readFile: jest.fn(),
        writeFile: jest.fn(),
      },
      scanResult: {
        identity: {
          type: 'npm',
          targetFile,
        },
        facts: [],
      },
      testResult: {
        issues: [],
        issuesData: {},
        depGraphData: {} as any,
      },
      options: {
        packageManager,
      },
    };
  }

  it('should return NPM for package-lock.json', () => {
    const entity = createMockEntity('package-lock.json');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.NPM);
  });

  it('should return NPM for package.json', () => {
    const entity = createMockEntity('package.json');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.NPM);
  });

  it('should return NPM for nested package-lock.json', () => {
    const entity = createMockEntity('packages/frontend/package-lock.json');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.NPM);
  });

  it('should return null for unsupported file types', () => {
    const entity = createMockEntity('requirements.txt');
    expect(getHandlerType(entity)).toBeNull();
  });

  it('should return null when targetFile is undefined', () => {
    const entity = createMockEntity(undefined);
    expect(getHandlerType(entity)).toBeNull();
  });

  it('should use packageManager override when provided', () => {
    const entity = createMockEntity('some-file.txt', 'npm');
    expect(getHandlerType(entity)).toBe(SUPPORTED_HANDLER_TYPES.NPM);
  });

  it('should return null for unknown packageManager override', () => {
    const entity = createMockEntity('package-lock.json', 'unknown');
    expect(getHandlerType(entity)).toBeNull();
  });
});

