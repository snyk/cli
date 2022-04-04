// This artifact was generated using GopherJS and https://github.com/snyk/snyk-iac-parsers

const gopherJsArtifact: HclToJsonArtifact = require('./parser');

type FilePath = string;
type FileContent = string;
type MapOfFiles = Record<FilePath, FileContent>;
type ParsedResults = {
  parsedFiles: MapOfFiles;
  failedFiles: MapOfFiles;
  debugLogs: MapOfFiles;
};

interface HclToJsonArtifact {
  parseModule: (MapOfFiles) => ParsedResults;
}

export default function hclToJsonV2(files: MapOfFiles): ParsedResults {
  return gopherJsArtifact.parseModule(files);
}
