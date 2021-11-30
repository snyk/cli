import path from 'path';

/**
 * Gets the path to a fixture.
 *
 * Use createProject instead to avoid modifying the same path as
 * other tests. Only use this when createProject is unfeasible.
 */
export function getFixturePath(fixtureName: string): string {
  return path.join(__dirname, '../../fixtures', fixtureName);
}
