import { standardizePackageName } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/standardize-package-name';

describe('standardizePackageName', () => {
  it('lowercases as expected', () => {
    const name = standardizePackageName('Django');
    expect(name).toEqual('django');
  });
  it('replaces _  as expected', () => {
    const name = standardizePackageName('clickhouse_driver');
    expect(name).toEqual('clickhouse-driver');
  });
  it('works on package@version', () => {
    const name = standardizePackageName('clickhouse_driver@0.1.4');
    expect(name).toEqual('clickhouse-driver@0.1.4');
  });
});
