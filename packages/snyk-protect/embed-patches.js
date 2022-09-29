/*
  This script should be run only once
  It will generate a list of all the patches available for all the static libraries taken from our S3 bucket
*/

const { execSync } = require('child_process');
const semver = require('semver');
const fs = require('fs');
const { request } = require('./dist/lib/http'); // using a built version as not to add dependencies

// List taken from our S3 bucket of all patches we offer
const patchedLibraries = [
  'axios',
  'backbone',
  'bassmaster',
  'bl',
  'call',
  'connect',
  'debug',
  'ejs',
  'electron-packager',
  'engine.io-client',
  'ep_imageconvert',
  'extend',
  'geddy',
  'gm',
  'handlebars',
  'hapi',
  'hawk',
  'hoek',
  'http-signature',
  'https-proxy-agent',
  'i18n-node-angular',
  'inert',
  'is-my-json-valid',
  'jsonwebtoken',
  'keystone',
  'ldapauth-fork',
  'libnotify',
  'lodash',
  'mapbox.js',
  'markdown-it',
  'marked',
  'millisecond',
  'mime',
  'minimatch',
  'moment',
  'mongoose',
  'ms',
  'mustache',
  'negotiator',
  'node-uuid',
  'printer',
  'qs',
  'request',
  'secure-compare',
  'semver',
  'send',
  'sequelize',
  'serve-index',
  'serve-static',
  'shell-quote',
  'shout',
  'st',
  'stringstream',
  'tar',
  'tomato',
  'tough-cookie',
  'tree-kill',
  'tunnel-agent',
  'uglify-js',
  'validator',
  'ws',
  'yar',
];

/**
 * @description Generate a JSON file with all the patches available
 * Find existing versions for all libraries with patches
 * Test each library-version with the Snyk Test to get the patches
 * Save the patches data in a JSON file
 * Save actual patches to disk
 */
async function generate(resultsFile = 'patches.json') {
  const finalPatches = fs.existsSync(resultsFile)
    ? JSON.parse(fs.readFileSync(resultsFile, 'utf8'))
    : [];

  let libraryVersionsToCheck = 0;
  for (const libraryName of patchedLibraries) {
    console.log(libraryName);
    if (fs.existsSync(`./patched-packages/${libraryName}.json`)) {
      // "cache" folder to allow rerunning the script
      console.log('  Skipping, already processed\n');
      continue;
    }
    let libraryPatches = [];
    const libraryVersions = JSON.parse(
      // An _issue_ with this approach is that this skips library versions marked as deprecated on the npm
      execSync(`npm view ${libraryName} versions --json --silent`),
    );
    console.log('  Versions to check:', libraryVersions.length);
    console.log('  Versions with patches:');
    libraryVersionsToCheck += libraryVersions.length;
    for (const libraryVersion of libraryVersions) {
      try {
        execSync(
          `SNYK_API=https://dev.snyk.io/api snyk test ${libraryName}@${libraryVersion} --json`,
          {
            maxBuffer: 1024 * 1024 * 10, // for really long snyk responses
          },
        );
        // Nothing to do for no vulns
      } catch (error) {
        const snykTestResult = JSON.parse(error.stdout.toString());
        for (const vulnerability of snykTestResult.vulnerabilities) {
          if (
            vulnerability.moduleName === libraryName && // don't check for transient vulns
            vulnerability.isPatchable
          ) {
            console.log('    -', libraryVersion);
            libraryPatches.push({
              vulnerabilityId: vulnerability.id,
              libraryVersion,
              patches: vulnerability.patches,
            });
          }
        }
      }
    }
    console.log('\n');
    fs.writeFileSync(
      `patched-packages/${libraryName}.json`,
      JSON.stringify(libraryPatches, null, 2),
    );
    finalPatches.push(...libraryPatches);
    fs.writeFileSync(resultsFile, JSON.stringify(finalPatches, null, 2));
  }

  console.log('Checked versions:', libraryVersionsToCheck);

  const patchesToDownload = [];
  finalPatches.map((patchMetadata) => {
    const libraryVersion = patchMetadata.libraryVersion;
    patchMetadata.patches = patchMetadata.patches.filter((patch) => {
      return semver.satisfies(libraryVersion, patch.version);
    });
    patchMetadata.patches = patchMetadata.patches.map((patch) => {
      delete patch.id; // We don't need these fields
      delete patch.comments;
      delete patch.modificationTime;
      patch.urls.forEach(async (url) => {
        const patchFilename = url.split('/').pop();
        if (fs.existsSync('patches/' + patchFilename)) {
          return;
        }
        patchesToDownload.push({
          url,
          patchFilename,
        });
      });
      patch.urls = patch.urls.map((url) => {
        return url.split('/').pop();
      });
      return patch;
    });
    return patchMetadata;
  });
  fs.writeFileSync(resultsFile, JSON.stringify(finalPatches, null, 2));

  patchesToDownload.forEach(async ({ url, patchFilename }) => {
    const { body: diff } = await request(url); // Download patches from the URL
    fs.writeFileSync('patches/' + patchFilename, diff);
  });
}

generate();
