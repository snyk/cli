import * as runtime from '../../../src/cli/runtime';

describe('verify supported nodejs runtime versions', () => {
  it('current runtime is supported', async () => {
    expect(runtime.isSupported(process.versions.node)).toBeTruthy();
  });

  it('pre-release is supported', async () => {
    expect(runtime.isSupported('19.0.0-pre')).toBeTruthy();
  });
});

describe('verify unsupported nodejs runtime versions', () => {
  it('v6.16.0 is not supported', async () => {
    expect(runtime.isSupported('6.16.0')).toBeFalsy();
  });

  it('v0.10 is not supported', async () => {
    expect(runtime.isSupported('0.10.48')).toBeFalsy();
  });

  it('v0.12 is not supported', async () => {
    expect(runtime.isSupported('0.12.18')).toBeFalsy();
  });

  it('v4.0.0 is not supported', async () => {
    expect(runtime.isSupported('4.0.0')).toBeFalsy();
  });

  it('verifies v6.4.0 is not supported', async () => {
    expect(runtime.isSupported('6.4.0')).toBeFalsy();
  });

  it('verifies v8.0.0 is not supported', async () => {
    expect(runtime.isSupported('8.0.0')).toBeFalsy();
  });
});
