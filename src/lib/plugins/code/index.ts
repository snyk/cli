
import { getCodeAnalysisAndParseResults } from './analysis';
import { getCodeDisplayedOutput } from './format/output-format';
import { EcosystemPlugin } from '../../ecosystems/types';

export const codePlugin: EcosystemPlugin = {
  async scan(options) {
    return null as any;
  },
  async display() {
    return '';
  },
  async test(paths, options) {
    const spinnerLbl = 'Querying vulnerabilities database...';
    // Currently code supports only one path
    const sarifTypedResult = await getCodeAnalysisAndParseResults(spinnerLbl, paths[0], options);
    const meta = 'Meta temp';
    const prefix = 'Prefix temp';
    const readableResult = await getCodeDisplayedOutput(sarifTypedResult, meta, prefix);
    return { readableResult };
  },
};
