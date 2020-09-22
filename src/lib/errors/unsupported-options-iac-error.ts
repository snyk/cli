export function SupportLocalFileOnlyIacError(): string {
  return 'iac test option currently supports only a single local file';
}

export function UnsupportedOptionFileIacError(path: string): string {
  return (
    `Not a recognised option, did you mean "snyk iac test ${path}"? ` +
    'Check other options by running snyk iac --help'
  );
}

export function IacDirectoryWithoutAnyIacFileError(): string {
  return 'iac test support single valid file or a directory of valid files';
}
