//TODO(orka): future - change this file
import { SupportedCloudConfigs } from '../cloud-config/cloud-config-projects';

interface Scan {
  type: string;
  targetFile: string;
  data: any;
}

export interface CloudConfigFile {
  fileContent: string;
  fileType: 'yaml' | 'yml' | 'json';
}

export interface CloudConfigScan extends Scan {
  type: SupportedCloudConfigs;
  targetFile: string;
  data: CloudConfigFile;
  targetFileRelativePath: string;
  originalProjectName: string;
  policy: string;
  projectNameOverride?: string;
}
