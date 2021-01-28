module.exports = test;

const detect = require('../detect');
const detectIac = require('../iac/detect-iac');
const { runTest } = require('./run-test');
const chalk = require('chalk');
const pm = require('../package-managers');
const iacProjects = require('../iac/constants');
const codeProjects = require('../code/constants');
const {
  UnsupportedPackageManagerError,
  NotSupportedIacFileError,
  NotSupportedIacAllProjects,
} = require('../errors');
const { isMultiProjectScan } = require('../is-multi-project-scan');

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
  try {
    if (!options.allProjects) {
      options.packageManager = options.iac
        ? await detectIac.getProjectType(root, options)
        : options.code
        ? 'code'
        : detect.detectPackageManager(root, options);
    }
    return run(root, options).then((results) => {
      for (const res of results) {
        if (!res.packageManager) {
          res.packageManager = options.packageManager;
        }

        // For IaC Directory support - make sure the result get the right project type
        // after finding this is a Directory case
        if (
          options.iac &&
          res.result &&
          res.result.projectType &&
          options.packageManager === iacProjects.IacProjectType.MULTI_IAC
        ) {
          res.packageManager = res.result.projectType;
        }
        if (
          options.code &&
          res.result &&
          res.result.projectType &&
          options.packageManager === codeProjects.CODE
        ) {
          res.packageManager = res.result.projectType;
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

function run(root, options) {
  const projectType = options.packageManager;
  validateProjectType(options, projectType);
  return runTest(projectType, root, options);
}

function validateProjectType(options, projectType) {
  if (options.code) {
    return;
  }
  if (options.iac) {
    if (options.allProjects) {
      throw new NotSupportedIacAllProjects(options.path);
    }
    if (!iacProjects.TEST_SUPPORTED_IAC_PROJECTS.includes(projectType)) {
      throw new NotSupportedIacFileError(projectType);
    }
  } else {
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
}
