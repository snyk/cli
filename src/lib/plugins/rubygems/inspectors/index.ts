import * as gemfile from './gemfile';
import * as gemspec from './gemspec';
import { Files } from './try-get-spec';

export interface Spec {
  packageName: string;
  targetFile: string;
  files: Files;
}

export const inspectors = [gemfile, gemspec];
