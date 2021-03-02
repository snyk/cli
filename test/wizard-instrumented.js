module.exports = interactive;

var proxyquire = require('proxyquire');
var sinon = require('sinon');
var spy;
var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  '@snyk/inquirer': {
    prompt: function(q, cb) {
      if (!cb) {
        cb = (_) => Promise.resolve(_);
      }

      if (spy) {
        var res = q.reduce(function(acc, curr, i, all) {
          if (curr.when && !curr.when(acc)) {
            return acc;
          }
          var res = spy(curr, spy.callCount, i, all, acc);
          acc[curr.name] = res;
          return acc;
        }, {});

        return cb(res);
      }
      return cb(q);
    },
  },
});

function respondWith(q, res) {
  if (res === undefined) {
    return null;
  }

  if (q.type === 'list') {
    return (
      q.choices
        .map(function(choice) {
          if (choice.value.choice === res) {
            return choice;
          }
          return false;
        })
        .filter(Boolean)
        .pop() || null
    );
  }

  if (q.type === 'confirm') {
    return { value: res };
  }

  // otherwise free text
  return { value: res };
}

function getDefaultChoice(q) {
  var def = q.default;
  var choices = q.choices;
  return choices[def || 0];
}

function interactive(vulns, originalResponses, options) {
  var responses = [].slice.call(originalResponses); // copy
  if (!options) {
    options = {};
  }

  var callback = function() {};

  if (options.callback) {
    callback = options.callback;
  }

  spy = sinon.spy(function(q, i, j, all, acc) {
    var intercept = callback(q, i, j, all, acc);

    if (intercept !== undefined) {
      return intercept;
    }

    var response = responses.shift();

    if (response === undefined) {
      if (options.earlyExit) {
        return false;
      }

      throw new Error('Out of responses to ' + q.name);
    }

    if (typeof response === 'string' && response.indexOf('default:') === 0) {
      var def = getDefaultChoice(q);
      response = response.slice('default:'.length);
      if (def.value.choice !== response) {
        throw new Error(
          'default did not match on ' +
            q.name +
            ', ' +
            def.value.choice +
            ' != ' +
            response,
        );
      }
    }

    var res = respondWith(q, response);
    if (res === null) {
      throw new Error('missing prompt response to ' + q.name);
    }

    return res.value;
  });

  return wizard
    .interactive(vulns, options.pkg, options.policy, options)
    .then(function(res) {
      if (responses.length) {
        throw new Error(
          'Too many responses. Remaining: ' + JSON.stringify(responses),
        );
      }
      return res;
    });
}
