import { obfuscateArgs } from '../../../../src/lib/utils';
import { ArgsOptions, MethodArgs } from '../../../../src/cli/args';

describe('Sanitize args', () => {
  it('should obfuscate username and password when both are provided', () => {
    const argsWithUsernameAndPassword: ArgsOptions = {
      _doubleDashArgs: [],
      _: ['snyk/goof-image:latest'],
      org: 'demo-org',
      username: 'fakeuser',
      password: 'fakepass',
      file: 'Dockerfile',
      rawArgv: [],
    };

    const resultWithFlag = obfuscateArgs(
      argsWithUsernameAndPassword,
    ) as ArgsOptions;

    expect(resultWithFlag.username).toEqual('username-set');
    expect(resultWithFlag.password).toEqual('password-set');
    expect(resultWithFlag._[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag.org).toEqual('demo-org');
    expect(resultWithFlag.file).toEqual('Dockerfile');
  });

  it('should obfuscate personally identifiable information from args', () => {
    const argsWithUsernameAndPassword: ArgsOptions = {
      _doubleDashArgs: [],
      _: ['snyk/goof-image:latest'],
      org: 'demo-org',
      username: 'fakeuser',
      file: 'Dockerfile',
      rawArgv: [],
    };

    const resultWithFlag = obfuscateArgs(
      argsWithUsernameAndPassword,
    ) as ArgsOptions;

    expect(resultWithFlag.username).toEqual('username-set');
    expect(resultWithFlag.password).toBeUndefined();
    expect(resultWithFlag._[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag.org).toEqual('demo-org');
    expect(resultWithFlag.file).toEqual('Dockerfile');
  });

  it('should obfuscate nested PII', () => {
    const argsWithUsernameAndPassword: MethodArgs = [
      'snyk/goof-image:latest',
      {
        _doubleDashArgs: [],
        _: ['snyk/goof-image:latest'],
        username: 'fakeuser',
        password: 'fakepass',
        debug: true,
        docker: true,
        rawArgv: [],
      },
    ];

    const resultWithFlag = obfuscateArgs(argsWithUsernameAndPassword);

    expect(resultWithFlag[0]).toEqual('snyk/goof-image:latest');
    expect(resultWithFlag[1].username).toEqual('username-set');
    expect(resultWithFlag[1].password).toEqual('password-set');
  });
});
