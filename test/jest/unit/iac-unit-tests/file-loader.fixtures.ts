import path from 'path';

const fileContent = 'dont-care';
const mixedDirectory = path.join(__dirname, 'mixed');

export const k8sDirectory = path.join(__dirname, 'kubernetes', 'files');
export const emptyDirectory = path.join(__dirname, 'empty-dir');
export const k8sFileStub = {
  fileContent,
  filePath: path.join(k8sDirectory, 'k8s.yaml'),
  fileType: 'yaml',
};

export const anotherK8sFileStub = {
  ...k8sFileStub,
  filePath: path.join(k8sDirectory, 'pod.yaml'),
};

export const terraformDirectory = path.join(__dirname, 'terraform', 'files');

export const terraformFileStub = {
  fileContent,
  filePath: path.join(terraformDirectory, 'main.tf'),
  fileType: 'tf',
};

export const anotherTerraformFileStub = {
  ...terraformFileStub,
  filePath: path.join(terraformDirectory, 'modules.tf'),
};

export const nonIacFileStub = {
  fileContent,
  filePath: path.join(mixedDirectory, 'this_shouldnt_load.sh'),
  fileType: 'sh',
};

export const emptyFileStub = {
  fileContent: '',
  filePath: path.join(mixedDirectory, 'this_shouldnt_load.yaml'),
  fileType: 'yaml',
};

export const anotherNonIacFileStub = {
  fileContent,
  filePath: path.join(mixedDirectory, 'this_also_shouldnt_load.js'),
  fileType: 'js',
};

export const level1Directory = path.join(__dirname, 'dir1');
export const level2Directory = path.join(level1Directory, 'dir2');
export const level3Directory = path.join(level2Directory, 'dir3');

export const level3FileStub = {
  ...terraformFileStub,
  filePath: path.join(level3Directory, 'main.tf'),
};

export const level2FileStub = {
  ...terraformFileStub,
  filePath: path.join(level2Directory, 'main.tf'),
};
