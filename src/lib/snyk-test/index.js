module.exports = test;

const detect = require('../detect');
const { runTest } = require('./run-test');

const chalk = require('chalk');
const pm = require('../package-managers');
const { UnsupportedPackageManagerError } = require('../errors');
const { isMultiProjectScan } = require('../is-multi-project-scan');
const { hasFeatureFlag } = require('../feature-flags');
const {
  PNPM_FEATURE_FLAG,
  DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
  MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
} = require('../package-managers');
const {
  getFeatureFlagValue,
  SHOW_MAVEN_BUILD_SCOPE,
} = require('../feature-flag-gateway');
const { getOrganizationID } = require('../organization');

async function test(root, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (!options) {
    options = {};
  }
  const promise = executeTest(root, options);
  if (callback) {
    promise
      .then((res) => {
        callback(null, res);
      })
      .catch(callback);
  }
  return promise;
}

async function executeTest(root, options) {
  let hasPnpmSupport = false;
  let hasImprovedDotnetWithoutPublish = false;
  let enableMavenDverboseExhaustiveDeps = false;
  try {
    hasPnpmSupport = await hasFeatureFlag(PNPM_FEATURE_FLAG, options);
    if (options['dotnet-runtime-resolution']) {
      hasImprovedDotnetWithoutPublish = await hasFeatureFlag(
        DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
        options,
      );
      if (hasImprovedDotnetWithoutPublish) {
        options.useImprovedDotnetWithoutPublish = true;
      }
    }
  } catch (err) {
    hasPnpmSupport = false;
  }

  try {
    const args = options['_doubleDashArgs'] || [];
    const verboseEnabled =
      args.includes('-Dverbose') ||
      args.includes('-Dverbose=true') ||
      !!options['print-graph'];
    if (verboseEnabled) {
      enableMavenDverboseExhaustiveDeps = await hasFeatureFlag(
        MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
        options,
      );
      if (enableMavenDverboseExhaustiveDeps) {
        options.mavenVerboseIncludeAllVersions =
          enableMavenDverboseExhaustiveDeps;
      }
    }
  } catch (err) {
    enableMavenDverboseExhaustiveDeps = false;
  }

  try {
    const featureFlags = hasPnpmSupport
      ? new Set([PNPM_FEATURE_FLAG])
      : new Set([]);

    const showScope = await getFeatureFlagValue(
      SHOW_MAVEN_BUILD_SCOPE,
      getOrganizationID(),
    );
    if (showScope) {
      featureFlags.add(SHOW_MAVEN_BUILD_SCOPE);
    }

    if (!options.allProjects) {
      options.packageManager = detect.detectPackageManager(
        root,
        options,
        featureFlags,
      );
    }

    return run(root, options, featureFlags).then((results) => {
      for (const res of results) {
        if (!res.packageManager) {
          res.packageManager = options.packageManager;
        }
      }
      if (results.length === 1) {
        // Return only one result if only one found as this is the default usecase
        return results[0];
      }
      // For gradle, yarnWorkspaces, allProjects we may be returning more than one result
      return results;
    });
  } catch (error) {
    return Promise.reject(
      chalk.red.bold(error.message ? error.message : error),
    );
  }
}

function run(root, options, featureFlags) {
  const projectType = options.packageManager;
  validateProjectType(options, projectType, featureFlags);
  return runTest(projectType, root, options, featureFlags);
}

function validateProjectType(options, projectType, featureFlags) {
  if (projectType === 'pnpm' && !featureFlags.has(PNPM_FEATURE_FLAG)) {
    throw new UnsupportedPackageManagerError(projectType);
  }

  if (
    !(
      options.docker ||
      isMultiProjectScan(options) ||
      pm.SUPPORTED_PACKAGE_MANAGER_NAME[projectType]
    )
  ) {
    throw new UnsupportedPackageManagerError(projectType);
  }
}
