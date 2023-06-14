import { v4 as uuidv4 } from 'uuid';
import * as makeRequest from '../../../src/lib/request/promise';
import { getOrg } from '../../../src/lib/ecosystems/unmanaged/utils';

describe('getOrg', () => {
  let makeRequestSpy;
  let makeRequestRestSpy;

  beforeEach(() => {
    const orgId = uuidv4();

    makeRequestSpy = jest.spyOn(makeRequest, 'makeRequest').mockResolvedValue({
      orgs: [{ id: orgId, slug: 'org1' }],
    });

    makeRequestRestSpy = jest
      .spyOn(makeRequest, 'makeRequestRest')
      .mockResolvedValue({
        data: {
          attributes: {
            default_org_context: orgId,
          },
        },
      });
  });

  afterEach(() => {
    makeRequestSpy.mockRestore();
    makeRequestRestSpy.mockRestore();
  });

  it('returns a UUID when parameter is null', async () => {
    const orgId = await getOrg(null);

    expect(orgId).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('returns a UUID when parameter is an emptry string', async () => {
    const orgId = await getOrg('');

    expect(orgId).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('returns a UUID when parameter is a matching org slug', async () => {
    const orgId = await getOrg('org1');

    expect(orgId).toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/,
    );
  });

  it('returns an empty string when parameter is not a matching org slug', async () => {
    const orgId = await getOrg('org2');

    expect(orgId).toBe('');
  });

  it('returns the same string when parameter is a UUID', async () => {
    const uuid = uuidv4();
    const orgId = await getOrg(uuid);

    expect(orgId).toBe(uuid);
  });
});
