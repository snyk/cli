const fs = require('fs');
const hcltojson = require('./dist/hcltojson-v2.js');
const assert = require('assert');
const path = require('path');

const filePath = './sg_open_ssh_defaults.tf';
const invalidFilePath = './sg_open_ssh_defaults_invalid_hcl.tf';
const originalFileContent = fs.readFileSync(
  path.join(__dirname, filePath),
  'utf-8',
);
const invalidFileContent = fs.readFileSync(
  path.join(__dirname, invalidFilePath),
  'utf-8',
);

const expectedParsedJSON =
  '{\n' +
  '\t"resource": {\n' +
  '\t\t"aws_security_group": {\n' +
  '\t\t\t"allow_ssh": {\n' +
  '\t\t\t\t"cidr_blocks": "dummy_value",\n' +
  '\t\t\t\t"description": "Allow SSH inbound from anywhere",\n' +
  '\t\t\t\t"name": "allow_ssh"\n' +
  '\t\t\t}\n' +
  '\t\t}\n' +
  '\t}\n' +
  '}';

// assert that we can call this function from JS code and get expected results
const { parsedFiles, failedFiles } = hcltojson.parseModule({
  [filePath]: originalFileContent,
  [invalidFilePath]: invalidFileContent,
});

assert.deepStrictEqual(
  parsedFiles,
  {
    [filePath]: expectedParsedJSON,
  },
  'Parsed JSON does not match expected',
);
assert.deepStrictEqual(
  failedFiles,
  {
    [invalidFilePath]: 'Invalid HCL provided',
  },
  'Invalid parsing does not match expected',
);

console.log('Tests completed');
