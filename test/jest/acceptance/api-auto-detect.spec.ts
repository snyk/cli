import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 10);

describe('Auto detect API URL', () => {
  it('Based on OAuth token claim', async () => {
    const expectedApiUrl = 'https://api.my.special.url.io';
    const payload = {
      sub: '1234567890',
      name: 'John Doe',
      iat: 1516239022,
      aud: [expectedApiUrl],
    };
    const oauthToken = {
      access_token: `a.${Buffer.from(JSON.stringify(payload))
        .toString('base64')
        .replace(/=+$/, '')}.b`,
      token_type: 'Bearer',
      refresh_token: 'configRefreshToken',
      expiry: '3023-03-29T17:47:13.714448+02:00',
    };

    const envVars = {
      ...process.env,
      INTERNAL_OAUTH_TOKEN_STORAGE: JSON.stringify(oauthToken),
    };

    const actual = await runSnykCLI(`woof --language=cat --env=SNYK_API`, {
      env: envVars,
    });
    console.debug(actual.stdout);
    expect(actual.stdout).toContainText(expectedApiUrl);
  });
});
