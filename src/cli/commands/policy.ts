import { display } from '../../lib/display-policy';
import { loadPolicy } from './load-or-create-policy';

async function displayPolicy(path?: string): Promise<string> {
  return await display(loadPolicy(path));
}

export = displayPolicy;
