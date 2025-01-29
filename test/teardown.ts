import * as fse from 'fs-extra';
import { dirname } from 'path';

export default (): void => {
  if (
    process.env.SNYK_CONFIG_FILE &&
    process.env.SNYK_CONFIG_FILE.includes('snyk-e2e-test-config-')
  ) {
    console.log('Cleaning up:', process.env.SNYK_CONFIG_FILE);
    fse.remove(dirname(process.env.SNYK_CONFIG_FILE));
  }
};
