module.exports = add;

var debug = require('debug')('snyk:policy');

function add(policy, type, options) {
  if (type !== 'ignore' && type !== 'patch') {
    throw new Error('policy.add: unknown type "' + type + '" to add to');
  }

  if (!options || !options.id || !options.path) {
    throw new Error('policy.add: required option props { id, path }');
  }

  var id = options.id;
  var path = options.path;
  var data = Object.keys(options).reduce(function (acc, curr) {
    if (curr === 'id' || curr === 'path') {
      return acc;
    }

    acc[curr] = options[curr];
    return acc;
  }, {});

  if (!policy[type][id]) {
    policy[type][id] = [];
  }

  /* istanbul ignore if */
  if (policy[type][id][path]) {
    debug('policy.add: path already exists', policy[type][id][path]);
  }

  var rule = {};
  rule[path] = data;

  policy[type][id].push(rule);

  return policy;
}
