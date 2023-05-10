import config from './config';

// disable IaC describe for FedRAMP, if you enable this, please correct or delete the needed -fedramp.md with this to be included
export const isIacDescribeDisabled = config.API.includes('snykgov')
  ? true
  : false;

// disable IaC test cloud-context flag for FedRAMP, if you enable this, please correct or delete the needed -fedramp.md with this to be included
export const isIacCloudContextDisabled = config.API.includes('snykgov')
  ? true
  : false;
