import { getCodeAnalysisAndParseResults } from './analysis';
import { isCodeTest } from './validate';
import {
  getCodeDisplayedOutput,
  getPrefix,
  getMeta,
} from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';
import errors = require('../../errors/legacy-errors');

export const codePlugin: EcosystemPlugin = {
  async scan(options) {
    return null as any;
  },
  async display() {
    return '';
  },
  async test(paths, options) {
    const isCodeTestRun = await isCodeTest(options);
    if (!isCodeTestRun) {
      errors('code');
    }
    const spinnerLbl = 'Querying vulnerabilities database...';
    // Currently code supports only one path
    const path = paths[0];
    const sarifTypedResult = await getCodeAnalysisAndParseResults(
      spinnerLbl,
      path,
      options,
    );
    const meta = getMeta(options, path);
    const prefix = getPrefix(path);
    const readableResult = await getCodeDisplayedOutput(
      sarifTypedResult,
      meta,
      prefix,
    );
    return { readableResult };
  },
};
