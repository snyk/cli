import * as tap from 'tap';
import {
  getIntegrationName,
  getIntegrationVersion,
  integrationNameHeader,
  integrationVersionHeader,
} from '../src/lib/analytics-sources';

const { test, beforeEach } = tap;

const emptyArgs = [];

beforeEach((done) => {
  delete process.env[integrationNameHeader];
  delete process.env[integrationVersionHeader];
  done();
});

test('Integration name is empty by default', (t) => {
  t.equal(getIntegrationName(emptyArgs), '');
  t.end();
});

test('Integration name is loaded from envvar', (t) => {
  process.env[integrationNameHeader] = 'NPM';
  t.equal(getIntegrationName(emptyArgs), 'NPM');

  process.env[integrationNameHeader] = 'STANDALONE';
  t.equal(getIntegrationName(emptyArgs), 'STANDALONE');
  t.end();
});

test('Integration name is empty when envvar is not recognized', (t) => {
  process.env[integrationNameHeader] = 'INVALID';
  t.equal(getIntegrationName(emptyArgs), '');
  t.end();
});

test('Integration version is empty by default', (t) => {
  t.equal(getIntegrationVersion(emptyArgs), '');
  t.end();
});

test('Integration version is loaded from envvar', (t) => {
  process.env[integrationVersionHeader] = '1.2.3';
  t.equal(getIntegrationVersion(emptyArgs), '1.2.3');
  t.end();
});

test('Integration name is loaded and formatted from CLI flag', (t) => {
  t.equal(getIntegrationName([{ integrationName: 'homebrew' }]), 'HOMEBREW');
  t.end();
});

test('Integration name is loaded and validated from CLI flag', (t) => {
  t.equal(getIntegrationName([{ integrationName: 'invalid' }]), '');
  t.end();
});

test('Integration version is loaded from CLI flag', (t) => {
  t.equal(
    getIntegrationVersion([{ integrationVersion: '1.2.3-Crystal' }]),
    '1.2.3-Crystal',
  );
  t.end();
});
