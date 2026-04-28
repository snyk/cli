import { sendPayloadsWithFirstPriority } from '../../../../../src/lib/snyk-test/run-test';
import { Payload } from '../../../../../src/lib/snyk-test/types';

describe('sendPayloadsWithFirstPriority', () => {
  it('runs first docker payload before starting remaining payloads', async () => {
    let firstResolved = false;
    let secondStartedBeforeFirstResolved = false;
    let thirdStartedBeforeFirstResolved = false;
    const requestOrder: string[] = [];

    const payloads = [
      createPayload('os'),
      createPayload('app-1'),
      createPayload('app-2'),
    ];

    const sendRequest = jest.fn((payload: Payload) => {
      const targetFile = getTargetFile(payload);
      requestOrder.push(targetFile);

      return new Promise<string>((resolve) => {
        if (targetFile === 'os') {
          setTimeout(() => {
            firstResolved = true;
            resolve(targetFile);
          }, 25);
          return;
        }

        if (targetFile === 'app-1' && !firstResolved) {
          secondStartedBeforeFirstResolved = true;
        }
        if (targetFile === 'app-2' && !firstResolved) {
          thirdStartedBeforeFirstResolved = true;
        }

        resolve(targetFile);
      });
    });

    const responses = await sendPayloadsWithFirstPriority(
      payloads,
      sendRequest,
      {
        docker: true,
      } as any,
    );

    expect(sendRequest).toHaveBeenCalledTimes(3);
    expect(requestOrder).toEqual(['os', 'app-1', 'app-2']);
    expect(secondStartedBeforeFirstResolved).toBe(false);
    expect(thirdStartedBeforeFirstResolved).toBe(false);
    expect(responses).toEqual(['os', 'app-1', 'app-2']);
  });

  it('keeps non-docker behavior (all payloads scheduled via pMap)', async () => {
    const payloads = [createPayload('one'), createPayload('two')];
    const sendRequest = jest.fn(async (payload: Payload) =>
      getTargetFile(payload),
    );

    const responses = await sendPayloadsWithFirstPriority(
      payloads,
      sendRequest,
      {
        docker: false,
      } as any,
    );

    expect(sendRequest).toHaveBeenCalledTimes(2);
    expect(responses).toEqual(['one', 'two']);
  });
});

function createPayload(targetFile: string): Payload {
  return {
    method: 'POST',
    url: 'https://snyk.example/test-dependencies',
    json: true,
    headers: {
      'x-is-ci': false,
      authorization: 'token test',
    },
    body: {
      scanResult: {
        identity: {
          type: 'deb',
          targetFile,
        },
        facts: [],
      },
    },
  };
}

function getTargetFile(payload: Payload): string {
  const body = payload.body as any;
  return String(body.scanResult.identity.targetFile);
}
