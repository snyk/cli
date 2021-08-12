import * as analytics from '../../../../../src/lib/analytics';
import * as request from '../../../../../src/lib/request';
import { argsFrom } from './utils';
import * as apiTokenModule from '../../../../../src/lib/api-token';

describe('analytics module', () => {
  it('sends anaytics with no token set', async () => {
    analytics.add('k1', 'v1');
    const requestSpy = jest.spyOn(request, 'makeRequest');
    const someTokenExistsSpy = jest.spyOn(apiTokenModule, 'someTokenExists');
    someTokenExistsSpy.mockReturnValue(false);
    requestSpy.mockImplementation(jest.fn());
    await analytics.addDataAndSend({
      args: argsFrom({}),
    });
    expect(requestSpy).toBeCalledTimes(1);
    expect(requestSpy.mock.calls[0][0]).not.toHaveProperty(
      'headers.authorization',
    );
  });
});
