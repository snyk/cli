import { isSupported } from '../../../src/cli/runtime';

describe('isSupported', () => {
  it('supports this test runtime', async () => {
    expect(isSupported(process.versions.node)).toBe(true);
  });

  it('supports pre-release versions', async () => {
    expect(isSupported('16.0.0-pre')).toBe(true);
  });

  it('supports minimum version', async () => {
    expect(isSupported('12.0.0')).toBe(true);
  });

  it('does not support versions below minimum version', async () => {
    expect(isSupported('8.0.0')).toBe(false);
    expect(isSupported('10.0.0')).toBe(false);
    expect(isSupported('11.9.0')).toBe(false);
  });
});
