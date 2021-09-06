import * as snyk from './';
import { makeRequest } from './request';
import config from './config';

export async function actionAllowed(
  action: string,
  options: { org?: string },
): Promise<{ allowed: boolean; reason: string }> {
  const org = options.org || config.org || null;

  try {
    const res = await makeRequest({
      method: 'GET',
      url: config.API + '/authorization/' + action,
      json: true,
      headers: {
        authorization: 'token ' + snyk.api,
      },
      qs: org && { org },
    });

    return (res as any).body.result;
  } catch (err) {
    return {
      allowed: false,
      reason: 'There was an error while checking authorization',
    };
  }
}
