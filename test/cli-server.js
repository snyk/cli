const restify = require('restify');
const fs = require('fs');

module.exports = function(root, apikey, notAuthorizedApiKey) {
  const server = restify.createServer({
    name: 'snyk-mock-server',
    version: '1.0.0',
    handleUncaughtExceptions: true,
  });

  server.use(restify.plugins.acceptParser(server.acceptable));
  server.use(restify.plugins.queryParser({ mapParams: true }));
  server.use(restify.plugins.bodyParser({ mapParams: true }));

  [root + '/verify/callback', root + '/verify/token'].map(function(url) {
    server.post(url, function(req, res) {
      if (req.params.api) {
        if (
          req.params.api === apikey ||
          (notAuthorizedApiKey && req.params.api === notAuthorizedApiKey)
        ) {
          return res.send({
            ok: true,
            api: apikey,
          });
        }
      }

      if (req.params.token) {
        return res.send({
          ok: true,
          api: apikey,
        });
      }

      res.status(401);
      res.send({
        ok: false,
      });
    });
  });

  server.get(root + '/vuln/npm/:module/:version', function(req, res, next) {
    res.send(req.params);
    return next();
  });

  server.get(root + '/vuln/npm/:module', function(req, res, next) {
    const module = req.params.module;
    const body = fs.readFileSync(
      __dirname + '/fixtures/cli-test-results/' + module,
      'utf8',
    );
    res.send(JSON.parse(body));
    return next();
  });

  server.put(root + '/monitor/npm', function(req, res) {
    return res.send({
      id: 'test',
    });
  });

  server.get(root + '/authorization/:action', function(req, res, next) {
    const authorizationToken = req.headers.authorization.replace('token ', '');
    if (authorizationToken === notAuthorizedApiKey) {
      res.send({
        result: {
          allowed: false,
          reason: 'Not authorized',
          reasonCode: 'testReasonCode',
        },
      });
    } else {
      res.send({ result: { allowed: true } });
    }
    return next();
  });

  return server;
};
