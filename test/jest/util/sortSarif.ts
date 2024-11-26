export function sortSarifByResults(sarifPayload) {
  sarifPayload.runs[0].results = sarifPayload.runs[0].results.sort((a, b) => {
    return a.fingerprints.identity.localeCompare(b.fingerprints.identity);
  });

  return sarifPayload;
}
