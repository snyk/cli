export function getOrganizationID(): string {
  if (process.env.SNYK_INTERNAL_ORGID != undefined) {
    return process.env.SNYK_INTERNAL_ORGID;
  }
  return '';
}
