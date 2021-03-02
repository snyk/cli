export = answersToTasks;

import * as debugModule from 'debug';
const debug = debugModule('snyk');
const cloneDeep = require('lodash.clonedeep');

function answersToTasks(answers) {
  const tasks = {
    ignore: [],
    update: [],
    patch: [],
    skip: [],
  };

  Object.keys(answers).forEach((key) => {
    // if we're looking at a reason, skip it
    if (key.indexOf('-reason') !== -1) {
      return;
    }

    // ignore misc questions, like "add snyk test to package?"
    if (key.indexOf('misc-') === 0) {
      return;
    }

    const answer = answers[key];
    const task = answer.choice;
    if (task === 'review' || task === 'skip') {
      // task = 'skip';
      return;
    }

    const vuln = answer.vuln;

    if (task === 'patch' && vuln.grouped && vuln.grouped.upgrades) {
      // ignore the first as it's the same one as this particular answer
      debug(
        'additional answers required: %s',
        vuln.grouped.count - 1,
        vuln.grouped,
      );

      const additional = vuln.grouped.upgrades.slice(1);

      additional.forEach((upgrade) => {
        const copy = cloneDeep(vuln);
        copy.from = upgrade.from;
        copy.__filename = upgrade.filename;
        copy.patches = upgrade.patches;
        copy.version = upgrade.version;
        tasks[task].push(copy);
      });
    }

    if (task === 'ignore') {
      answer.meta.reason = answers[key + '-reason'];
      if (answer.meta.vulnsInGroup) {
        // also ignore any in the group
        answer.meta.vulnsInGroup.forEach((vulnInGroup) => {
          tasks[task].push({
            meta: answer.meta,
            vuln: vulnInGroup,
          });
        });
      } else {
        tasks[task].push(answer);
      }
    } else {
      tasks[task].push(vuln);
    }
  });

  return tasks;
}
