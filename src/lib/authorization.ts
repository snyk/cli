import { getAuthHeader } from './api-token';
import config from './config';
import { makeRequest } from './request';

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
        authorization: getAuthHeader(),
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
