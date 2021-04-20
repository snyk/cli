// This artifact was generated using GopherJS and https://github.com/tmccombs/hcl2json (version v0.3.1)
const gopherJsArtifact: HclToJsonArtifact = require('./parser');

interface HclToJsonArtifact {
  hcltojson: (string) => Record<string, unknown>;
}

export default function hclToJson(
  fileContent: string,
): Record<string, unknown> {
  return gopherJsArtifact.hcltojson(fileContent);
}
