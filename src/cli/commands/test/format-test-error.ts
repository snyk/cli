export function formatTestError(error) {
  // Possible error cases:
  // - the test found some vulns. `error.message` is a
  // JSON-stringified
  //   test result.
  // - the flow failed, `error` is a real Error object.
  // - the flow failed, `error` is a number or string
  // describing the problem.
  //
  // To standardise this, make sure we use the best _object_ to
  // describe the error.
  let errorResponse;
  if (error instanceof Error) {
    errorResponse = error;
  } else if (typeof error !== 'object') {
    errorResponse = new Error(error);
  } else {
    try {
      errorResponse = JSON.parse(error.message);
    } catch (unused) {
      errorResponse = error;
    }
  }
  return errorResponse;
}
