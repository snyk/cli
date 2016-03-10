module.exports = {
  silenceLog: silenceLog,
  extendExpiries: extendExpiries,
};

function silenceLog() {
  var old = console.log;

  console.log = function () {};

  return function() {
    console.log = old;
  };
}

function extendExpiries(policy) {
  var d = new Date(Date.now() + (1000 * 60 * 60 * 24)).toJSON();
  Object.keys(policy.ignore).forEach(function (id) {
    policy.ignore[id].forEach(function (rule) {
      var path = Object.keys(rule).shift();
      rule[path].expires = d;
    });
  });
}