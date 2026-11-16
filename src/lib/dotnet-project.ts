import * as path from 'path';
import { SUPPORTED_MANIFEST_FILES } from './package-managers';

export const DOTNET_PROJECT_EXTENSIONS: readonly string[] = [
  SUPPORTED_MANIFEST_FILES.CSPROJ,
  SUPPORTED_MANIFEST_FILES.VBPROJ,
  SUPPORTED_MANIFEST_FILES.FSPROJ,
];

export function isDotnetProjectFile(file: string): boolean {
  return DOTNET_PROJECT_EXTENSIONS.includes(path.extname(file).toLowerCase());
}
