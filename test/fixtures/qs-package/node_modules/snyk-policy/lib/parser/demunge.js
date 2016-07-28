module.exports = demunge;

function demunge(policy, apiRoot) {
  if (!apiRoot) {
    apiRoot = '';
  }

  var res = ['ignore', 'patch'].reduce(function (acc, type) {
    acc[type] = policy[type] ? Object.keys(policy[type]).map(function (id) {
      var paths = policy[type][id].map(function (pathObj) {
        var path = Object.keys(pathObj).pop();
        var res = {
          path: path,
        };
        if (type === 'ignore') {
          res.reason = pathObj[path].reason;
          res.expires = new Date(pathObj[path].expires);
        }

        return res;
      });
      return {
        id: id,
        url: apiRoot + '/vuln/' + id,
        paths: paths,
      };
    }) : [];
    return acc;
  }, {});

  res.version = policy.version;

  return res;
}