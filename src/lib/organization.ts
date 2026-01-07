export function getOrganizationID(): string {
  if (process.env.SNYK_INTERNAL_ORGID) {
    return process.env.SNYK_INTERNAL_ORGID;
  }

  if (process.env.SNYK_CFG_INTERNAL_ORGID) {
    return process.env.SNYK_CFG_INTERNAL_ORGID;
  }

  return '';
}
