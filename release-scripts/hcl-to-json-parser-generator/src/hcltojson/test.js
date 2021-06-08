/* eslint-disable @typescript-eslint/camelcase */
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const { hcltojson } = require('./dist/hcltojson');

const tf = fs.readFileSync(path.join(__dirname, 'example.tf'), 'utf-8');
const expected = {
  resource: {
    aws_security_group: {
      allow_ssh: {
        description: 'Allow SSH inbound from anywhere',
        ingress: {
          cidr_blocks: ['0.0.0.0/0'],
          from_port: 22,
          protocol: 'tcp',
          to_port: 22,
        },
        name: 'allow_ssh',
        vpc_id: 'arn',
      },
    },
  },
};

assert.deepEqual(
  hcltojson(tf),
  expected,
  'Parsed Terraform does not match expected',
);

console.log('OK');
