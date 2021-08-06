import { PATH_SEPARATOR } from '../../../lib/constants';

export {
  getUpdatePrompts,
  getPatchPrompts,
  getIgnorePrompts,
  getPrompts,
  nextSteps,
  startOver,
};

const cloneDeep = require('lodash.clonedeep');
const get = require('lodash.get');
const omit = require('lodash.omit');
import * as semver from 'semver';
import { format as fmt } from 'util';
import * as debugModule from 'debug';
const protect = require('../../../lib/protect');
import { parsePackageString as moduleToObject } from 'snyk-module';
import * as config from '../../../lib/config';
import * as snykPolicy from 'snyk-policy';
import chalk from 'chalk';
import { icon, color } from '../../../lib/theme';
import { AnnotatedIssue, SEVERITY } from '../../../lib/snyk-test/legacy';
import { colorTextBySeverity } from '../../../lib/snyk-test/common';
import { titleCaseText } from '../../../lib/formatters/legacy-format-issue';

const debug = debugModule('snyk');

const ignoreDisabledReasons = {
  notAdmin: 'Set to ignore (only administrators can ignore issues)',
  disregardFilesystemIgnores:
    'Set to ignore (ignoring via the CLI is not enabled for this organization)',
};

// via http://stackoverflow.com/a/4760279/22617
function sort(prop) {
  let sortOrder = 1;
  if (prop[0] === '-') {
    sortOrder = -1;
    prop = prop.substr(1);
  }

  return (a, b) => {
    const result = a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0;
    return result * sortOrder;
  };
}

function createSeverityBasedIssueHeading(msg: string, severity: SEVERITY) {
  // Example: ✗ Medium severity vulnerability found in xmldom
  return colorTextBySeverity(severity, msg);
}

function sortUpgradePrompts(a, b) {
  let res = 0;

  // first sort by module affected
  if (!a.from[1]) {
    return -1;
  }

  if (!b.from[1]) {
    return 1;
  }

  const pa = moduleToObject(a.from[1]);
  const pb = moduleToObject(b.from[1]);
  res = sort('name')(pa, pb);
  if (res !== 0) {
    return res;
  }

  // we should have the same module, so the depth should be the same
  if (a.upgradePath[1] && b.upgradePath[1]) {
    // put upgrades ahead of patches
    if (b.upgradePath[1] === false) {
      return 1;
    }
    const pua = moduleToObject(a.upgradePath[1]);
    const pub = moduleToObject(b.upgradePath[1]);

    res = semver.compare(pua.version, pub.version) * -1;

    if (res !== 0) {
      return res;
    }
  } else {
    if (a.upgradePath[1]) {
      return -1;
    }

    if (b.upgradePath[1]) {
      return 1;
    }

    // if no upgrade, then hopefully a patch
    res = sort('publicationTime')(b, a);
  }

  return res;
}

function sortPatchPrompts(a, b) {
  let res = 0;

  // first sort by module affected
  const afrom = a.from.slice(1).pop();
  const bfrom = b.from.slice(1).pop();

  if (!afrom) {
    return -1;
  }

  if (!bfrom[1]) {
    return 1;
  }

  const pa = moduleToObject(afrom);
  const pb = moduleToObject(bfrom);
  res = sort('name')(pa, pb);
  if (res !== 0) {
    return res;
  }

  // if no upgrade, then hopefully a patch
  res = sort('publicationTime')(b, a);

  return res;
}

function stripInvalidPatches<T extends AnnotatedIssue>(
  originalVuln: T,
): Omit<T, 'description' | 'credit'> {
  // strip the irrelevant patches from the vulns at the same time, collect
  // the unique package vulns

  // strip verbose meta
  const vuln = omit(cloneDeep(originalVuln), ['description', 'credit']);

  if (vuln.patches) {
    vuln.patches = vuln.patches.filter((patch) => {
      return semver.satisfies(vuln.version, patch.version);
    });

    // sort by patchModification, then pick the latest one
    vuln.patches = vuln.patches
      .sort((a, b) => {
        return b.modificationTime < a.modificationTime ? -1 : 1;
      })
      .slice(0, 1);

    // FIXME hack to give all the patches IDs if they don't already
    if (vuln.patches[0] && !vuln.patches[0].id) {
      vuln.patches[0].id = vuln.patches[0].urls[0]
        .split('/')
        .slice(-1)
        .pop() as string;
    }
  }

  return vuln;
}

function getPrompts(vulns, policy) {
  return getUpdatePrompts(vulns, policy)
    .concat(getPatchPrompts(vulns, policy))
    .concat(getIgnorePrompts(vulns, policy));
}

function getPatchPrompts(
  vulns: AnnotatedIssue[],
  policy,
  options?: PromptOptions,
): Prompt[] {
  debug('getPatchPrompts');
  if (!vulns || vulns.length === 0) {
    return [];
  }

  let res = vulns
    .map((vuln) => stripInvalidPatches(vuln))
    .filter((vuln) => {
      // if there's any upgrade available, then remove it
      return canBeUpgraded(vuln) || vuln.type === 'license' ? false : true;
    }) as AnnotatedIssue[];
  // sort by vulnerable package and the largest version
  res.sort(sortPatchPrompts);

  const copy = {};
  let offset = 0;
  // mutate our objects so we can try to group them
  // note that I use slice first becuase the `res` array will change length
  // and `reduce` _really_ doesn't like when you change the array under
  // it's feet
  // TODO(kyegupov): convert this reduce to a loop, make grouping logic more clear
  res.slice(0).reduce((acc, curr, i, all) => {
    // var upgrades = curr.upgradePath[1];
    // otherwise it's a patch and that's hidden for now
    if (curr.patches && curr.patches.length) {
      // TODO allow for cross over patches on modules (i.e. patch can work
      // on A-1 and A-2)
      let last;

      if (acc[curr.id]) {
        last = curr.id;
      } else {
        // try to find the right vuln id based on the publication times
        last = (
          all
            .filter((vuln) => {
              const patch = vuln.patches[0];

              // don't select the one we're looking at

              if (curr.id === vuln.id) {
                return false;
              }

              // only look at packages with the same name
              if (curr.name !== vuln.name || !patch) {
                return false;
              }

              // and ensure the patch can be applied to *our* module version
              if (semver.satisfies(curr.version, patch.version)) {
                // finally make sure the publicationTime is newer than the curr
                // vulnerability
                if (curr.publicationTime! < vuln.publicationTime!) {
                  debug(
                    'found alternative location for %s@%s (%s by %s) in %s',
                    curr.name,
                    curr.version,
                    patch.version,
                    curr.id,
                    vuln.id,
                  );
                  return true;
                }
              }
            })
            .shift() || curr
        ).id;
      }

      if (!acc[last]) {
        // only copy the biggest change
        copy[last] = cloneDeep(curr);
        acc[last] = curr;
        return acc;
      }

      // only happens on the 2nd time around
      if (!acc[last].grouped) {
        acc[last].grouped = {
          affected: moduleToObject(acc[last].name + '@' + acc[last].version),
          main: true,
          id: acc[last].id + '-' + i,
          count: 1,
          upgrades: [
            {
              // all this information is used when the user selects group patch
              // specifically: in ./tasks.js~42
              from: acc[last].from,
              filename: acc[last].__filename,
              patches: acc[last].patches,
              version: acc[last].version,
            },
          ],
          patch: true,
        };

        acc[last].grouped.affected.full = acc[last].name;

        // splice this vuln into the list again so if the user choses to review
        // they'll get this individual vuln and remediation
        copy[last].grouped = {
          main: false,
          requires: acc[last].grouped.id,
        };

        res.splice(i + offset, 0, copy[last]);
        offset++;
      }

      acc[last].grouped.count++;

      (curr as AnnotatedIssueWithGrouping).grouped = {
        main: false,
        requires: acc[last].grouped.id,
      };

      // add the from path to our group upgrades if we don't have it already
      const have = !!acc[last].grouped.upgrades.filter((upgrade) => {
        return upgrade.from.join(' ') === curr.from.join(' ');
      }).length;

      if (!have) {
        acc[last].grouped.upgrades.push({
          from: curr.from,
          filename: curr.__filename,
          patches: curr.patches,
          version: curr.version,
        });
      } else {
        if (!acc[last].grouped.includes) {
          acc[last].grouped.includes = [];
        }
        acc[last].grouped.includes.push(curr.id);
      }
    }

    return acc;
  }, {});

  // FIXME this should not just strip those that have an upgrade path, but
  // take into account the previous answers, and if the package has been
  // upgraded, it should be left *out* of our list.
  res = res.filter((curr) => {
    // if (curr.upgradePath[1]) {
    //   return false;
    // }

    if (!curr.patches || curr.patches.length === 0) {
      return false;
    }

    return true;
  });

  const prompts = generatePrompt(res, policy, 'p', options);

  return prompts;
}

function getIgnorePrompts(vulns, policy, options?) {
  debug('getIgnorePrompts');
  if (!vulns || vulns.length === 0) {
    return [];
  }

  const res = vulns
    .map((vuln) => stripInvalidPatches(vuln))
    .filter((vuln) => {
      // remove all patches and updates

      // if there's any upgrade available
      if (canBeUpgraded(vuln)) {
        return false;
      }

      if (vuln.patches && vuln.patches.length) {
        return false;
      }

      return true;
    });

  const prompts = generatePrompt(res, policy, 'i', options);

  return prompts;
}

// This type was deduced from analyzing the code.
// Exact types of fields and the grouping logic still need investigation and documentation.
interface AnnotatedIssueWithGrouping extends AnnotatedIssue {
  grouped?: {
    main;
    requires;
    affected?;
    count?;
    upgrades?;
    patch?;
    id?;
  };
}

function getUpdatePrompts(vulns: AnnotatedIssue[], policy, options?): Prompt[] {
  debug('getUpdatePrompts');
  if (!vulns || vulns.length === 0) {
    return [];
  }

  let res = vulns
    .map((vuln) => stripInvalidPatches(vuln))
    .filter((vuln) => {
      // only keep upgradeable
      return canBeUpgraded(vuln);
    }) as AnnotatedIssueWithGrouping[];

  // sort by vulnerable package and the largest version
  res.sort(sortUpgradePrompts);

  let copy: AnnotatedIssueWithGrouping | null = null;
  let offset = 0;
  // mutate our objects so we can try to group them
  // note that I use slice first becuase the `res` array will change length
  // and `reduce` _really_ doesn't like when you change the array under
  // it's feet
  // TODO(kyegupov): rewrite this reduce into more readable loop, avoid mutating original list,
  // understand and document the grouping logic
  res.slice(0).reduce((acc, curr, i) => {
    const from = curr.from[1] as string;

    if (!acc[from]) {
      // only copy the biggest change
      copy = cloneDeep(curr);
      acc[from] = curr;
      return acc;
    }

    const upgrades = curr.upgradePath.slice(-1).shift() as string;
    // otherwise it's a patch and that's hidden for now
    if (upgrades && curr.upgradePath[1]) {
      if (!acc[from].grouped) {
        acc[from].grouped = {
          affected: moduleToObject(from),
          main: true,
          id: acc[from].id + '-' + i,
          count: 1,
          upgrades: [],
        };
        acc[from].grouped.affected.full = from;

        // splice this vuln into the list again so if the user choses to review
        // they'll get this individual vuln and remediation
        copy!.grouped = {
          main: false,
          requires: acc[from].grouped.id,
        };

        res.splice(i + offset, 0, copy as AnnotatedIssueWithGrouping);
        offset++;
      }

      acc[from].grouped.count++;

      curr.grouped = {
        main: false,
        requires: acc[from].grouped.id,
      };

      const p = moduleToObject(upgrades);
      if (
        p.name !== acc[from].grouped.affected.name &&
        (' ' + acc[from].grouped.upgrades.join(' ') + ' ').indexOf(
          p.name + '@',
        ) === -1
      ) {
        debug('+ adding %s to upgrades', upgrades);
        acc[from].grouped.upgrades.push(upgrades);
      }
    }

    return acc;
  }, {});

  // now strip anything that doesn't have an upgrade path
  res = res.filter((curr) => {
    return !!curr.upgradePath[1];
  });

  const prompts = generatePrompt(res, policy, 'u', options);

  return prompts;
}

function canBeUpgraded(vuln) {
  if (vuln.parentDepType === 'extraneous') {
    return false;
  }

  if (vuln.bundled) {
    return false;
  }

  if (vuln.shrinkwrap) {
    return false;
  }

  return vuln.upgradePath.some((pkg, i) => {
    // if the upgade path is to upgrade the module to the same range the
    // user already asked for, then it means we need to just blow that
    // module away and re-install
    if (vuln.from.length > i && pkg === vuln.from[i]) {
      return true;
    }

    // if the upgradePath contains the first two elements, that is
    // the project itself (i.e. jsbin) then the direct dependency can be
    // upgraded. Note that if the first two elements
    if (vuln.upgradePath.slice(0, 2).filter(Boolean).length) {
      return true;
    }
  });
}

type Choice = 'skip' | 'patch' | 'update' | 'review' | 'ignore';

type ChoiceDetails = {
  meta: Action['meta'];
  vuln: AnnotatedIssue;
  choice: Choice;
};

interface Action {
  value: Choice | ChoiceDetails;
  key?: string;
  name: string;
  short?: string;
  default?: boolean;
  meta?: any;
}

interface Prompt {
  when?: (answers) => void;
  name: string;
  type?: string;
  message: string;

  // These fields are assigned later
  default?: number | boolean | string;
  choices?: any[];
  vuln?: any;
  patches?: any;
}

interface PromptOptions {
  ignoreDisabled?: { reasonCode: string };
  earlyExit?: boolean;
  packageManager?: string;
}

function generatePrompt(
  vulns: AnnotatedIssueWithGrouping[],
  policy,
  prefix: string,
  options?: PromptOptions,
): Prompt[] {
  if (!prefix) {
    prefix = '';
  }
  if (!vulns) {
    vulns = []; // being defensive, but maybe we should throw an error?
  }

  const skipAction: Action = {
    value: 'skip', // the value that we get in our callback
    key: 's',
    name: 'Skip', // the text the user sees
  };

  const ignoreAction: Action = {
    value: options && options.ignoreDisabled ? 'skip' : 'ignore',
    key: 'i',
    meta: {
      // arbitrary data that we'll merged into the `value` later on
      days: 30,
    },
    short: 'Ignore',
    name:
      options && options.ignoreDisabled
        ? ignoreDisabledReasons[options.ignoreDisabled.reasonCode]
        : 'Set to ignore for 30 days (updates policy)',
  };

  const patchAction: Action = {
    value: 'patch',
    key: 'p',
    short: 'Patch',
    name:
      'Patch (modifies files locally, updates policy for `snyk protect` ' +
      'runs)',
  };

  const updateAction: Action = {
    value: 'update',
    key: 'u',
    short: 'Upgrade',
    name: '', // updated below to the name of the package to update
  };

  let prompts = vulns.map((vuln, i) => {
    let id = vuln.id || 'node-' + vuln.name + '@' + vuln.below;

    id += '-' + prefix + i;

    // make complete copies of the actions, otherwise we'll mutate the object
    const ignore = cloneDeep(ignoreAction);
    const skip = cloneDeep(skipAction);
    const patch = cloneDeep(patchAction);
    const update = cloneDeep(updateAction);
    const review: Action = {
      value: 'review',
      short: 'Review',
      name: 'Review issues separately',
    };

    const choices: Action[] = [];

    const from = vuln.from
      .slice(1)
      .filter(Boolean)
      .shift();

    // FIXME this should be handled a little more gracefully
    if (vuln.from.length === 1) {
      debug('Skipping issues in core package with no upgrade path: ' + id);
    }
    const vulnIn = vuln.from.slice(-1).pop();
    const severity = titleCaseText(vuln.severity);

    let infoLink = '    Info: ' + chalk.underline(config.ROOT);

    let messageIntro;
    let fromText: boolean | string = false;
    const group = vuln.grouped && vuln.grouped.main ? vuln.grouped : false;

    let originalSeverityStr = '';
    if (vuln.originalSeverity && vuln.originalSeverity !== vuln.severity) {
      originalSeverityStr = ` (originally ${titleCaseText(
        vuln.originalSeverity,
      )})`;
    }

    if (group) {
      infoLink += chalk.underline(
        '/package/npm/' + group.affected.name + '/' + group.affected.version,
      );
      const joiningText = group.patch ? 'in' : 'via';
      const issues = vuln.type === 'license' ? 'issues' : 'vulnerabilities';
      messageIntro = fmt(
        `${icon.ISSUE} %s %s %s introduced %s %s`,
        group.count,
        `${severity}${originalSeverityStr}`,
        issues,
        joiningText,
        group.affected.full,
      );
      messageIntro = createSeverityBasedIssueHeading(
        messageIntro,
        vuln.severity,
      );
    } else {
      infoLink += chalk.underline('/vuln/' + vuln.id);
      messageIntro = fmt(
        `${icon.ISSUE} %s severity %s found in %s, introduced via`,
        `${severity}${originalSeverityStr}`,
        vuln.type === 'license' ? 'issue' : 'vuln',
        vulnIn,
        from,
      );
      messageIntro = createSeverityBasedIssueHeading(
        messageIntro,
        vuln.severity,
      );
      messageIntro += '\n    Description: ' + vuln.title;
      fromText =
        from !== vuln.from.slice(1).join(PATH_SEPARATOR)
          ? '    From: ' + vuln.from.slice(1).join(PATH_SEPARATOR)
          : '';
    }

    let note: boolean | string = false;
    if (vuln.note) {
      if (group && group.patch) {
        // no-op
      } else {
        note = '   Note: ' + vuln.note;
      }
    }

    const res: Prompt = {
      when(answers) {
        let haventUpgraded = true;
        // only show this question if the user choose to review the details
        // of the vuln
        if (vuln.grouped && !vuln.grouped.main) {
          // find how they answered on the top level question
          const groupAnswer = Object.keys(answers)
            .map((key) => {
              if (answers[key].meta) {
                // this meta.groupId only appears on a "review" choice, and thus
                // this map will pick out those vulns that are specifically
                // associated with this review group.
                if (answers[key].meta.groupId === vuln.grouped!.requires) {
                  if (
                    answers[key].choice === 'ignore' &&
                    answers[key].meta.review
                  ) {
                    answers[key].meta.vulnsInGroup.push({
                      id: vuln.id,
                      from: vuln.from,
                    });
                    return false;
                  }

                  return answers[key];
                }
              }
              return false;
            })
            .filter(Boolean);

          if (!groupAnswer.length) {
            debug('no group answer: show %s when %s', vuln.id, false);
            return false;
          }

          // if we've upgraded, then stop asking
          let updatedTo: Prompt | null = null;
          haventUpgraded =
            groupAnswer.filter((answer) => {
              if (answer.choice === 'update') {
                updatedTo = answer;
                return true;
              }
            }).length === 0;

          if (!haventUpgraded) {
            // echo out what would be upgraded
            const via =
              'Fixed through previous upgrade instruction to ' +
              ((updatedTo as unknown) as Prompt).vuln.upgradePath[1];
            console.log(['', messageIntro, infoLink, via].join('\n'));
          }
        }

        if (haventUpgraded) {
          console.log(''); // blank line between prompts...kinda lame, sorry
        }

        debug('final show %s when %s', vuln.id, res);

        return res; // true = show next
      },
      name: id,
      type: 'list',
      message: [
        messageIntro,
        infoLink,
        fromText,
        note,
        chalk.green('\n  Remediation options'),
      ]
        .filter(Boolean)
        .join('\n'),
    };

    const upgradeAvailable = canBeUpgraded(vuln);
    const toPackage = vuln.upgradePath.filter(Boolean).shift();
    const isReinstall = toPackage === from;
    const isYarn = !!(options && options.packageManager === 'yarn');

    // note: the language presented the user is "upgrade" rather than "update"
    // this change came long after all this code was written. I've decided
    // *not* to update all the variables referring to `update`, but just
    // to warn my dear code-reader that this is intentional.

    // note: Yarn reinstallation does not currently work because the
    // remediation advice is actually for npm

    if (upgradeAvailable && (!isYarn || !isReinstall)) {
      choices.push(update);

      const word = isReinstall ? 'Re-install ' : 'Upgrade to ';

      update.short = word + toPackage;
      let out = word + toPackage;
      const toPackageVersion = moduleToObject(toPackage as string).version;
      const diff = semver.diff(
        moduleToObject(from as string).version,
        toPackageVersion,
      );
      let lead = '';
      const breaking = color.status.error('potentially breaking change');
      if (diff === 'major') {
        lead = ' (' + breaking + ', ';
      } else {
        lead = ' (';
      }

      lead += 'triggers upgrade to ';
      if (group && group.upgrades.length) {
        out += lead + group.upgrades.join(', ') + ')';
      } else {
        const last = vuln.upgradePath.slice(-1).shift();
        if (toPackage !== last) {
          out += lead + last + ')';
        } else if (diff === 'major') {
          out += ' (' + breaking + ')';
        }
      }
      update.name = out;
    } else {
      // No upgrade available (as per no patch)
      let reason = '';

      if (vuln.parentDepType === 'extraneous') {
        reason = fmt('extraneous package %s cannot be upgraded', vuln.from[1]);
      } else if (vuln.shrinkwrap) {
        reason = fmt(
          'upgrade unavailable as %s@%s is shrinkwrapped by %s',
          vuln.name,
          vuln.version,
          vuln.shrinkwrap,
        );
      } else if (vuln.bundled) {
        reason = fmt(
          'upgrade unavailable as %s is bundled in vulnerable %s',
          vuln.bundled.slice(-1).pop(),
          vuln.name,
        );
      } else {
        reason =
          "no sufficient upgrade available we'll notify you when " +
          'there is one';
      }

      choices.push({
        value: 'skip',
        key: 'u',
        short: 'Upgrade (none available)',
        name: 'Upgrade (' + reason + ')',
      });
    }

    let patches = null;

    if (upgradeAvailable && group) {
      // no-op
    } else {
      if (vuln.patches && vuln.patches.length) {
        // check that the version we have has a patch available
        patches = protect.patchesForPackage(vuln);

        if (patches !== null) {
          if (!upgradeAvailable) {
            patch.default = true;
          }
          res.patches = patches;

          if (group) {
            patch.name = fmt('Patch the %s vulnerabilities', group.count);
          }

          choices.push(patch);
        }
      }
    }

    // only show patch option if this is NOT a grouped upgrade
    if (upgradeAvailable === false || !group) {
      if (patches === null) {
        // add a disabled option saying that patch isn't available
        // note that adding `disabled: true` does nothing, so the user can
        // actually select this option. I'm not 100% it's the right thing,
        // but we'll keep a keen eye on user feedback.
        choices.push({
          value: 'skip',
          key: 'p',
          short: 'Patch (none available)',
          name:
            "Patch (no patch available, we'll notify you when " +
            'there is one)',
        });
      }
    }

    if (group) {
      review.meta = {
        groupId: group.id,
        review: true,
      };
      choices.push(review);

      ignore.meta.review = true;
      ignore.meta.groupId = group.id;
      ignore.meta.vulnsInGroup = [];
    }

    if (patches === null && !upgradeAvailable) {
      ignore.default = true;
    }

    choices.push(ignore);
    choices.push(skip);

    // look for a default - the `res.default` needs to be the index
    // of the choice, so we remap the choices to include the index, value of
    // choice and whether it was supposed to be a default. If the user is
    // updating their policy options, then we select the choice they had
    // before, otherwise we select the default
    res.default = (
      choices
        .map((choice, cIndex) => {
          return { i: cIndex, default: choice.default };
        })
        .filter((choice) => {
          return choice.default;
        })
        .shift() || { i: 0 }
    ).i;

    // kludge to make sure that we get the vuln in the user selection
    res.choices = choices.map((choice) => {
      const value = choice.value;
      // this allows us to pass more data into the inquirer results
      if (vuln.grouped && !vuln.grouped.main) {
        if (!choice.meta) {
          choice.meta = {};
        }
        choice.meta.groupId = vuln.grouped.requires;
      }
      choice.value = {
        meta: choice.meta,
        vuln,
        choice: value as Choice, // this is the string "update", "ignore", etc
      };
      return choice;
    });

    res.vuln = vuln;

    return res;
  });

  // zip together every prompt and a prompt asking "why", note that the `when`
  // callback controls whether not to prompt the user with this question,
  // in this case, we always show if the user choses to ignore.
  prompts = prompts.reduce((acc: Prompt[], curr) => {
    acc.push(curr);
    const rule = snykPolicy.getByVuln(policy, curr.choices![0].value.vuln);
    let defaultAnswer = 'None given';
    if (rule && rule.type === 'ignore') {
      defaultAnswer = rule.reason;
    }
    const issue =
      curr.choices![0].value.vuln &&
      curr.choices![0].value.vuln.type === 'license'
        ? 'issue'
        : 'vulnerability';
    acc.push({
      name: curr.name + '-reason',
      message: '[audit] Reason for ignoring ' + issue + '?',
      default: defaultAnswer,
      when(answers) {
        if (!answers[curr.name]) {
          return false;
        }
        return answers[curr.name].choice === 'ignore';
      },
    });
    return acc;
  }, []);

  return prompts;
}

function startOver() {
  return {
    name: 'misc-start-over',
    message:
      'Existing .snyk policy found. Ignore it and start from scratch [y] or update it [N]?',
    type: 'confirm',
    default: false,
  };
}

function nextSteps(pkg, prevAnswers) {
  let skipProtect = false;
  const prompts: Prompt[] = [];
  let i;

  i = get(pkg, 'scripts.test', '').indexOf('snyk test');
  if (i === -1) {
    prompts.push({
      name: 'misc-add-test',
      message:
        'Add `snyk test` to package.json file to fail test on newly ' +
        'disclosed vulnerabilities?\n' +
        'This will require authentication via `snyk auth` when running tests.',
      type: 'confirm',
      default: false,
    });
  }

  // early exit if prevAnswers is false (when snyk test.ok === true)
  if (prevAnswers === false) {
    return prompts;
  }

  i = get(pkg, 'scripts.prepublish', '').indexOf('snyk-pro');

  // if `snyk protect` doesn't already appear, then check if we need to add it
  if (i === -1) {
    skipProtect = Object.keys(prevAnswers).every((key) => {
      return prevAnswers[key].choice !== 'patch';
    });
  } else {
    skipProtect = true;
  }

  if (!skipProtect) {
    prompts.push({
      name: 'misc-add-protect',
      message:
        'Add `snyk protect` as a package.json installation hook to ' +
        'apply chosen patches on install?',
      type: 'confirm',
      default: true,
    });
  }

  return prompts;
}
