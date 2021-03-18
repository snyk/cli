import { Options } from 'snyk-cpp-plugin';
import { GoodResult, BadResult } from './types';
import { formatJsonOutput } from '../test/formatters/format-test-results';
import { jsonStringifyLargeObject } from '../../../lib/json';

export function processJsonMonitorResponse(
  results: Array<GoodResult | BadResult>,
  options: Options,
): string {
  let dataToSend = results.map((result) => {
    if (result.ok) {
      const jsonData = JSON.parse(result.data);
      if (result.projectName) {
        jsonData.projectName = result.projectName;
      }
      return jsonData;
    }

    const jsonData = {
      ok: false,
      error: result.data.message,
      path: result.path,
    };
    return jsonStringifyLargeObject(formatJsonOutput(jsonData, options));
  });
  // backwards compat - strip array if only one result
  dataToSend = dataToSend.length === 1 ? dataToSend[0] : dataToSend;
  const stringifiedData = JSON.stringify(dataToSend, null, 2);

  if (results.every((res) => res.ok)) {
    return stringifiedData;
  }
  const err = new Error(stringifiedData) as any;
  err.json = dataToSend;
  throw err;
}
