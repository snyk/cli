module.exports = test;

const detect = require('../detect');
const { runTest } = require('./run-test');
const pm = require('../package-managers');
const { UnsupportedPackageManagerError } = require('../errors');
const { isMultiProjectScan } = require('../is-multi-project-scan');
const {
  SHOW_MAVEN_BUILD_SCOPE,
  SHOW_NPM_SCOPE,
  hasFeatureFlag,
  isFeatureFlagSupportedForOrg,
  hasFeatureFlagOrDefault,
} = require('../feature-flags');
const {
  PNPM_FEATURE_FLAG,
  DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
  MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
  INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
  DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
} = require('../package-managers');
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
  const hasPnpmSupport = await hasFeatureFlagOrDefault(
    PNPM_FEATURE_FLAG,
    options,
  );
  const includeGoStandardLibraryDeps = await hasFeatureFlagOrDefault(
    INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
    options,
  );
  const disableGoPackageUrls = await hasFeatureFlagOrDefault(
    DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
    options,
  );
  const hasImprovedDotnetWithoutPublish =
    !!options['dotnet-runtime-resolution'] &&
    (await hasFeatureFlagOrDefault(
      DOTNET_WITHOUT_PUBLISH_FEATURE_FLAG,
      options,
    ));

  let enableMavenDverboseExhaustiveDeps = false;
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
    const featureFlags = new Set();
    if (hasPnpmSupport) {
      featureFlags.add(PNPM_FEATURE_FLAG);
    }

    if (includeGoStandardLibraryDeps) {
      featureFlags.add(INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG);
    }

    if (disableGoPackageUrls) {
      featureFlags.add(DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG);
    }

    if (hasImprovedDotnetWithoutPublish) {
      options.useImprovedDotnetWithoutPublish = true;
    }

    const showMavenScope = await isFeatureFlagSupportedForOrg(
      SHOW_MAVEN_BUILD_SCOPE,
      getOrganizationID(),
    );
    if (showMavenScope.ok) {
      featureFlags.add(SHOW_MAVEN_BUILD_SCOPE);
    }

    const showScope = await isFeatureFlagSupportedForOrg(
      SHOW_NPM_SCOPE,
      getOrganizationID(),
    );
    if (showScope.ok) {
      featureFlags.add(SHOW_NPM_SCOPE);
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
    // Preserve the error object to maintain properties like errorCatalog, code, userMessage, etc.
    // The error will be formatted later in formatTestError if needed
    return Promise.reject(error);
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
