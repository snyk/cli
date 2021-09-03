import * as debugModule from 'debug';
const debug = debugModule('snyk');

import * as path from 'path';
import * as inquirer from '@snyk/inquirer';
import * as fs from 'fs';
import * as tryRequire from 'snyk-try-require';
import chalk from 'chalk';
import * as url from 'url';
const cloneDeep = require('lodash.clonedeep');
const get = require('lodash.get');
import { exec } from 'child_process';
import { apiTokenExists } from '../../../lib/api-token';
import * as auth from '../auth/is-authed';
import getVersion from '../version';
import * as allPrompts from './prompts';
import answersToTasks from './tasks';
import * as snyk from '../../../lib/';
import { monitor as snykMonitor } from '../../../lib/monitor';
import { isCI } from '../../../lib/is-ci';
const protect = require('../../../lib/protect');
import * as authorization from '../../../lib/authorization';
import * as config from '../../../lib/config';
import * as spinner from '../../../lib/spinner';
import * as analytics from '../../../lib/analytics';
import * as alerts from '../../../lib/alerts';
import npm, { getVersion as npmGetVersion } from '../../../lib/npm';
import * as detect from '../../../lib/detect';
import * as plugins from '../../../lib/plugins';
import { ModuleInfo as moduleInfo } from '../../../lib/module-info';
import { MisconfiguredAuthInCI } from '../../../lib/errors/misconfigured-auth-in-ci-error';
import { MissingTargetFileError } from '../../../lib/errors/missing-targetfile-error';
import * as pm from '../../../lib/package-managers';
import { icon, color } from '../../../lib/theme';
import {
  Options,
  MonitorMeta,
  MonitorResult,
  PackageJson,
  ProtectOptions,
} from '../../../lib/types';
import { LegacyVulnApiResult } from '../../../lib/snyk-test/legacy';
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';

export default function wizard(options?: Options) {
  options = options || ({} as Options);
  options.org = options.org || config.org || null;

  return processPackageManager(options)
    .then(processWizardFlow)
    .catch((error) => Promise.reject(error));
}

async function processPackageManager(options: Options) {
  const packageManager = detect.detectPackageManager(process.cwd(), options);

  const supportsWizard = pm.WIZARD_SUPPORTED_PACKAGE_MANAGERS.includes(
    packageManager,
  );
  if (!supportsWizard) {
    return Promise.reject(
      `Snyk wizard for ${pm.SUPPORTED_PACKAGE_MANAGER_NAME[packageManager]} projects is not currently supported`,
    );
  }

  const nodeModulesExist = fs.existsSync(path.join('.', 'node_modules'));
  if (!nodeModulesExist) {
    // throw a custom error
    throw new Error(
      "Missing node_modules folder: we can't patch without having installed packages." +
        `\nPlease run '${packageManager} install' first.`,
    );
  }

  return Promise.resolve(options);
}

async function loadOrCreatePolicyFile(options: Options & ProtectOptions) {
  let policyFile;
  try {
    policyFile = await snyk.policy.load(options['policy-path'], options);
    return policyFile;
  } catch (error) {
    // if we land in the catch, but we're in interactive mode, then it means
    // the file hasn't been created yet, and that's fine, so we'll resolve
    // with an empty object
    if (error.code === 'ENOENT') {
      options.newPolicy = true;
      policyFile = snyk.policy.create();
      return policyFile;
    }

    throw error;
  }
}

async function processWizardFlow(options) {
  spinner.sticky();
  const message = options['dry-run']
    ? '*** dry run ****'
    : '~~~~ LIVE RUN ~~~~';
  debug(message);
  const policyFile = await loadOrCreatePolicyFile(options);

  const authed = await auth.isAuthed();
  analytics.add('inline-auth', !authed);
  if (!authed && isCI()) {
    throw MisconfiguredAuthInCI();
  }

  apiTokenExists();
  const cliIgnoreAuthorization = await authorization.actionAllowed(
    'cliIgnore',
    options,
  );

  options.ignoreDisabled = cliIgnoreAuthorization.allowed
    ? false
    : cliIgnoreAuthorization;
  if (options.ignoreDisabled) {
    debug('ignore disabled');
  }
  const intro = `Snyk's wizard will:

* Enumerate your local dependencies and query Snyk's servers for vulnerabilities
* Guide you through fixing found vulnerabilities
* Create a .snyk policy file to guide snyk commands such as \`test\` and \`protect\`
* Remember your dependencies to alert you when new vulnerabilities are disclosed
`;

  return Promise.resolve(intro)
    .then((str) => {
      if (!isCI()) {
        console.log(str);
      }
    })
    .then(() => {
      return new Promise<void>((resolve) => {
        if (options.newPolicy) {
          return resolve(); // don't prompt to start over
        }
        inquirer.prompt(allPrompts.startOver()).then((answers) => {
          analytics.add('start-over', answers['misc-start-over']);
          if (answers['misc-start-over']) {
            options['ignore-policy'] = true;
          }
          resolve();
        });
      });
    })
    .then(() => {
      // We need to have modules information for remediation. See Payload.modules
      options.traverseNodeModules = true;

      return snyk.test(process.cwd(), options).then((oneOrManyRes) => {
        if (oneOrManyRes[0]) {
          throw new Error(
            'Multiple subprojects are not yet supported by snyk wizard',
          );
        }
        const res = oneOrManyRes as LegacyVulnApiResult;
        if (alerts.hasAlert('tests-reached') && res.isPrivate) {
          return;
        }
        const packageFile = path.resolve(process.cwd(), 'package.json');
        if (!res.ok) {
          const vulns = res.vulnerabilities;
          const paths = vulns.length === 1 ? 'path' : 'paths';
          const ies = vulns.length === 1 ? 'y' : 'ies';
          // echo out the deps + vulns found
          console.log(
            'Tested %s dependencies for known vulnerabilities, %s',
            res.dependencyCount,
            chalk.bold.red(
              'found ' +
                res.uniqueCount +
                ' vulnerabilit' +
                ies +
                ', ' +
                vulns.length +
                ' vulnerable ' +
                paths +
                '.',
            ),
          );
        } else {
          console.log(
            color.status.success(
              `${icon.VALID} Tested %s dependencies for known vulnerabilities, no vulnerable paths found.`,
            ),
            res.dependencyCount,
          );
        }

        return snyk.policy.loadFromText(res.policy).then((combinedPolicy) => {
          return tryRequire(packageFile).then((pkg) => {
            options.packageLeading = pkg.leading;
            options.packageTrailing = pkg.trailing;
            return interactive(
              res,
              pkg,
              combinedPolicy,
              options,
            ).then((answers) => processAnswers(answers, policyFile, options));
          });
        });
      });
    });
}

export function interactive(test, pkg, policy, options) {
  const vulns = test.vulnerabilities;
  if (!policy) {
    policy = {};
  }

  if (!pkg) {
    // only really happening in tests
    pkg = {};
  }

  return new Promise((resolve) => {
    debug('starting questions');
    const prompts = allPrompts.getUpdatePrompts(vulns, policy, options);
    resolve(inquire(prompts, {}));
  })
    .then((answers) => {
      const prompts = allPrompts.getPatchPrompts(vulns, policy, options);
      return inquire(prompts, answers);
    })
    .then((answers) => {
      const prompts = allPrompts.getIgnorePrompts(vulns, policy, options);
      return inquire(prompts, answers);
    })
    .then((answers) => {
      const prompts = allPrompts.nextSteps(pkg, test.ok ? false : answers);
      return inquire(prompts, answers);
    })
    .then((answers) => {
      if (pkg.shrinkwrap) {
        answers['misc-build-shrinkwrap'] = true;
      }
      return answers;
    });
}

export function inquire(prompts, answers): Promise<{}> {
  if (prompts.length === 0) {
    return Promise.resolve(answers);
  }
  // inquirer will handle dots in name as path in hash (CSUP-272)
  prompts.forEach((prompt) => {
    prompt.name = prompt.name.replace(/\./g, '--DOT--');
  });
  return new Promise((resolve) => {
    inquirer.prompt(prompts).then((theseAnswers) => {
      answers = { ...answers, ...theseAnswers };
      Object.keys(answers).forEach((answerName) => {
        if (answerName.indexOf('--DOT--') > -1) {
          const newName = answerName.replace(/--DOT--/g, '.');
          answers[newName] = answers[answerName];
          delete answers[answerName];
        }
      });
      resolve(answers);
    });
  });
}

function getNewScriptContent(scriptContent, cmd) {
  if (scriptContent) {
    // only add the command if it's not already in the script
    if (scriptContent.indexOf(cmd) === -1) {
      return cmd + ' && ' + scriptContent;
    }
    return scriptContent;
  }
  return cmd;
}

function addProtectScripts(existingScripts, npmVersion, options) {
  const scripts = existingScripts ? cloneDeep(existingScripts) : {};
  scripts['snyk-protect'] = 'snyk protect';

  let cmd = 'npm run snyk-protect';

  // legacy check for `postinstall`, if `npm run snyk-protect` is in there
  // we'll replace it with `true` so it can be cleanly swapped out
  const postinstall = scripts.postinstall;
  if (postinstall && postinstall.indexOf(cmd) !== -1) {
    scripts.postinstall = postinstall.replace(cmd, 'true');
  }

  if (options.packageManager === 'yarn') {
    cmd = 'yarn run snyk-protect';
    scripts.prepare = getNewScriptContent(scripts.prepare, cmd);
    return scripts;
  }

  const npmVersionMajor = parseInt(npmVersion.split('.')[0], 10);
  if (npmVersionMajor >= 5) {
    scripts.prepare = getNewScriptContent(scripts.prepare, cmd);

    return scripts;
  }

  scripts.prepublish = getNewScriptContent(scripts.prepublish, cmd);

  return scripts;
}

function calculatePkgFileIndentation(packageFile: string): number {
  let pkgIndentation = 2;
  const whitespaceMatch = packageFile.match(/{\n(\s+)"/);
  if (whitespaceMatch && whitespaceMatch[1]) {
    pkgIndentation = whitespaceMatch[1].length;
  }
  return pkgIndentation;
}

export function processAnswers(answers, policy, options) {
  if (!options) {
    options = {};
  }
  options.packageLeading = options.packageLeading || '';
  options.packageTrailing = options.packageTrailing || '';
  // allow us to capture the answers the users gave so we can combine this
  // the scenario running
  if (options.json) {
    return Promise.resolve(JSON.stringify(answers, null, 2));
  }
  const cwd = process.cwd();
  const packageFile = path.resolve(cwd, 'package.json');
  const packageManager = detect.detectPackageManager(cwd, options);
  const targetFile = options.file || detect.detectPackageFile(cwd);
  if (!targetFile) {
    throw MissingTargetFileError(cwd);
  }
  const isLockFileBased =
    targetFile.endsWith('package-lock.json') ||
    targetFile.endsWith('yarn.lock');

  let pkg = {} as PackageJson;
  let pkgIndentation = 2;

  sendWizardAnalyticsData(answers);

  const tasks = answersToTasks(answers);
  debug(tasks);

  const live = !options['dry-run'];
  let snykVersion = '*';

  const res = protect
    .generatePolicy(policy, tasks, live, options.packageManager)
    .then(async (policy2) => {
      if (!live) {
        // if this was a dry run, we'll throw an error to bail out of the
        // promise chain, then in the catch, check the error.code and if
        // it matches `DRYRUN` we'll return the text and not an error
        // (which avoids the exit code 1).
        const e = new Error('This was a dry run: nothing changed');
        (e as any).code = 'DRYRUN';
        throw e;
      }

      await policy2.save(cwd, spinner);

      // don't do this during testing
      if (isCI() || process.env.TAP) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        exec(
          'git add .snyk',
          {
            cwd,
          },
          (error, stdout, stderr) => {
            if (error) {
              debug('error adding .snyk to git', error);
            }

            if (stderr) {
              debug('stderr adding .snyk to git', stderr.trim());
            }

            // resolve either way
            resolve();
          },
        );
      });
    })
    .then(() => {
      // re-read the package.json - because the generatePolicy can apply
      // an `npm install` which will change the deps
      return Promise.resolve(fs.readFileSync(packageFile, 'utf8'))
        .then((packageFileString) => {
          pkgIndentation = calculatePkgFileIndentation(packageFileString);
          return packageFileString;
        })
        .then(JSON.parse)
        .then((updatedPkg) => {
          pkg = updatedPkg;
        });
    })
    .then(getVersion)
    .then((v) => {
      debug('snyk version: %s', v);
      // little hack to circumvent local testing where the version will
      // be the git branch + commit
      if (v.match(/^\d+\./) === null) {
        v = '*';
      } else {
        v = '^' + v;
      }
      snykVersion = v;
    })
    .then(() => {
      analytics.add('add-snyk-test', answers['misc-add-test']);
      if (!answers['misc-add-test']) {
        return;
      }

      debug('adding `snyk test` to package');

      if (!pkg.scripts) {
        pkg.scripts = {};
      }

      const test = pkg.scripts.test;
      const cmd = 'snyk test';
      if (test && test !== 'echo "Error: no test specified" && exit 1') {
        // only add the test if it's not already in the test
        if (test.indexOf(cmd) === -1) {
          pkg.scripts.test = cmd + ' && ' + test;
        }
      } else {
        pkg.scripts.test = cmd;
      }
    })
    .then(async () => {
      const npmVersion = await npmGetVersion();
      analytics.add('add-snyk-protect', answers['misc-add-protect']);
      if (!answers['misc-add-protect']) {
        return;
      }

      debug('adding `snyk protect` to package');

      if (!pkg.scripts) {
        pkg.scripts = {};
      }

      pkg.scripts = addProtectScripts(pkg.scripts, npmVersion, options);

      pkg.snyk = true;
    })
    .then(() => {
      let lbl = 'Updating package.json...';
      const addSnykToDependencies =
        answers['misc-add-test'] || answers['misc-add-protect'];
      let updateSnykFunc = () => {
        return;
      }; // noop

      if (addSnykToDependencies) {
        updateSnykFunc = () => protect.install(packageManager, ['snyk'], live);
      }
      if (addSnykToDependencies) {
        debug('updating %s', packageFile);

        if (
          get(pkg, 'dependencies.snyk') ||
          get(pkg, 'peerDependencies.snyk') ||
          get(pkg, 'optionalDependencies.snyk')
        ) {
          // nothing to do as the user already has Snyk
          // TODO decide whether we should update the version being used
          // and how do we reconcile if the global install is older
          // than the local version?
        } else {
          const addSnykToProdDeps = answers['misc-add-protect'];
          const snykIsInDevDeps = get(pkg, 'devDependencies.snyk');

          if (addSnykToProdDeps) {
            if (!pkg.dependencies) {
              pkg.dependencies = {};
            }
            pkg.dependencies.snyk = snykVersion;
            lbl =
              'Adding Snyk to production dependencies ' +
              '(used by snyk protect)';

            // but also check if we should remove it from devDependencies
            if (snykIsInDevDeps) {
              delete pkg.devDependencies.snyk;
            }
          } else if (!snykIsInDevDeps) {
            if (!pkg.devDependencies) {
              pkg.devDependencies = {};
            }
            lbl = 'Adding Snyk to devDependencies (used by npm test)';
            pkg.devDependencies.snyk = snykVersion;
            updateSnykFunc = () =>
              protect.installDev(packageManager, ['snyk'], live);
          }
        }
      }

      if (addSnykToDependencies || tasks.update.length) {
        const packageString =
          options.packageLeading +
          JSON.stringify(pkg, null, pkgIndentation) +
          options.packageTrailing;
        return (
          spinner(lbl)
            .then(() => {
              fs.writeFileSync(packageFile, packageString);
              if (isLockFileBased) {
                // we need to trigger a lockfile update after adding snyk
                // as a dep
                return updateSnykFunc();
              }
            })
            // clear spinner in case of success or failure
            .then(spinner.clear<void>(lbl))
            .catch((error) => {
              spinner.clear<void>(lbl)();
              throw error;
            })
        );
      }
    })
    .then(() => {
      if (answers['misc-build-shrinkwrap'] && tasks.update.length) {
        debug('updating shrinkwrap');

        const lbl = 'Updating npm-shrinkwrap.json...';
        return (
          spinner(lbl)
            .then(() => npm('shrinkwrap', null, live, cwd, null))
            // clear spinner in case of success or failure
            .then(spinner.clear(lbl))
            .catch((error) => {
              spinner.clear<void>(lbl)();
              throw error;
            })
        );
      }
    })
    .then(() => {
      if (answers['misc-test-no-monitor']) {
        // allows us to automate tests
        return {
          id: 'test',
        } as MonitorResult;
      }

      debug('running monitor');
      const lbl =
        'Remembering current dependencies for future ' + 'notifications...';
      const meta = { method: 'wizard', packageManager };
      const plugin = plugins.loadPlugin(packageManager);
      const info = moduleInfo(plugin, options.policy);

      if (isLockFileBased) {
        // TODO: fix this by providing better patch support for yarn
        // yarn hoists packages up a tree so we can't assume their location
        // on disk without traversing node_modules
        // currently the npm@2 nd npm@3 plugin resolve-deps can do this
        // but not the latest node-lockfile-parser
        // HACK: for yarn set traverseNodeModules option to true
        // bypass lockfile test for wizard, but set this back
        // before we monitor
        options.traverseNodeModules = false;
      }

      // TODO: extract common inspect & monitor code and use the same way here
      // as during test & monitor
      return (
        info
          .inspect(cwd, targetFile, options)
          .then((inspectRes) => spinner(lbl).then(() => inspectRes))
          .then((inspectRes) => {
            // both ruby and node plugin return multi result
            return snykMonitor(
              cwd,
              meta as MonitorMeta,
              (inspectRes as MultiProjectResult).scannedProjects[0],
              options,
              inspectRes.plugin,
            );
          })
          // clear spinner in case of success or failure
          .then(spinner.clear(lbl))
          .catch((error) => {
            spinner.clear<void>(lbl)();
            throw error;
          })
      );
    })
    .then((monitorRes) => {
      const endpoint = url.parse(config.API);
      let leader = '';
      if (monitorRes.org) {
        leader = '/org/' + monitorRes.org;
      }
      endpoint.pathname = leader + '/monitor/' + monitorRes.id;
      const monitorUrl = url.format(endpoint);
      endpoint.pathname = leader + '/manage';
      const manageUrl = url.format(endpoint);

      return (
        (options.newPolicy
          ? // if it's a newly created file
            "\nYour policy file has been created with the actions you've " +
            'selected, add it to your source control (`git add .snyk`).'
          : // otherwise we updated it
            '\nYour .snyk policy file has been successfully updated.') +
        '\nTo review your policy, run `snyk policy`.\n\n' +
        'You can see a snapshot of your dependencies here:\n' +
        monitorUrl +
        '\n\n' +
        (monitorRes.isMonitored
          ? "We'll notify you when relevant new vulnerabilities are " +
            'disclosed.\n\n'
          : chalk.bold.red(
              'Project is inactive, so notifications are turned off.\n' +
                'Activate this project here: ' +
                manageUrl +
                '\n',
            )) +
        (monitorRes.trialStarted
          ? chalk.yellow(
              "You're over the free plan usage limit, \n" +
                'and are now on a free 14-day premium trial.\n' +
                'View plans here: ' +
                manageUrl +
                '\n\n',
            )
          : '')
      );
    })
    .catch((error) => {
      // if it's a dry run - exit with 0 status
      if (error.code === 'DRYRUN') {
        return error.message;
      }

      throw error;
    });

  return res;
}

function sendWizardAnalyticsData(answers): void {
  analytics.add(
    'answers',
    Object.keys(answers)
      .map((key) => {
        // if we're looking at a reason, skip it
        if (key.indexOf('-reason') !== -1) {
          return;
        }

        // ignore misc questions, like "add snyk test to package?"
        if (key.indexOf('misc-') === 0) {
          return;
        }

        const answer = answers[key];
        const entry = {
          vulnId: answer.vuln.id,
          choice: answer.choice,
          from: answer.vuln.from.slice(1),
        } as any;

        if (answer.vuln.grouped) {
          entry.batchMain = !!answer.vuln.grouped.main;
          entry.batch = true;
        }

        return entry;
      })
      .filter(Boolean),
  );
}
