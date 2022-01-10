import { MethodArgs } from '../args';
import { processCommandArgs } from './process-command-args';

export default async function drift(...args: MethodArgs): Promise<any> {
  const { options, paths } = processCommandArgs(...args);
  console.log(options);
  console.log(paths);
  if (options.iac != true) {
    throw new Error('BAD MODE');
  }
  console.log('snyk iac drift');
}
