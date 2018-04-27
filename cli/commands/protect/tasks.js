module.exports = answersToTasks;

var debug = require('debug')('snyk');
var _ = require('lodash');

function answersToTasks(answers) {
  var tasks = {
    ignore: [],
    update: [],
    patch: [],
    skip: [],
  };

  Object.keys(answers).forEach(function (key) {
    // if we're looking at a reason, skip it
    if (key.indexOf('-reason') !== -1) {
      return;
    }

    // ignore misc questions, like "add snyk test to package?"
    if (key.indexOf('misc-') === 0) {
      return;
    }

    var answer = answers[key];
    var task = answer.choice;
    if (task === 'review' || task === 'skip') {
      // task = 'skip';
      return;
    }

    var vuln = answer.vuln;

    if (task === 'patch' && vuln.grouped && vuln.grouped.upgrades) {
      // ignore the first as it's the same one as this particular answer
      debug('additional answers required: %s',
        vuln.grouped.count - 1,
        vuln.grouped);

      var additional = vuln.grouped.upgrades.slice(1);

      additional.forEach(function (upgrade) {
        var copy = _.cloneDeep(vuln);
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
        answer.meta.vulnsInGroup.forEach(function (vuln) {
          tasks[task].push({
            meta: answer.meta,
            vuln: vuln,
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
