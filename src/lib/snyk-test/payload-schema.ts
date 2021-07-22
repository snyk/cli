//TODO(orka): future - change this file
import { IacProjectTypes } from '../iac/constants';

interface Scan {
  type: string;
  targetFile: string;
  data: any;
}

interface IacFile {
  fileContent: string;
  fileType: 'yaml' | 'yml' | 'json' | 'tf';
}

export interface IacScan extends Scan {
  type: IacProjectTypes;
  targetFile: string;
  data: IacFile;
  targetFileRelativePath: string;
  originalProjectName: string;
  policy: string;
  projectNameOverride?: string;
}
