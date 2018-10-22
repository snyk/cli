var restify = require('restify');
var fs = require('fs');

module.exports = function (root, apikey) {
  var server = restify.createServer({
    name: 'snyk-mock-server',
    version: '1.0.0',
  });
  server._reqLog = [];
  server.popRequest = function () {
    return server._reqLog.pop();
  };
  server.use(restify.acceptParser(server.acceptable));
  server.use(restify.queryParser());
  server.use(restify.bodyParser());
  server.use(function logRequest(req, res, next) {
    server._reqLog.push(req);
    next();
  });

  [
    root + '/verify/callback',
    root + '/verify/token',
  ].map(function (url) {
    server.post(url, function (req, res) {
      if (req.params.api && req.params.api === apikey) {
        return res.send({
          ok: true,
          api: apikey,
        });
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

  server.use(function (req, res, next) {
    if (!server._nextResponse) {
      return next();
    }
    var response = server._nextResponse;
    delete server._nextResponse;
    res.send(response);
  });

  server.get(root + '/vuln/:registry/:module', function (req, res, next) {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/vuln/:registry', function (req, res, next) {
    var vulnerabilities = [];
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }
    if (req.query.org && req.query.org === 'org-with-vulns') {
      vulnerabilities.push({
        title: 'XML External Entity (XXE) Injection',
        credit: [],
        description: '',
        moduleName: 'nokogiri',
        language: 'ruby',
        packageManager: 'rubygems',
        semver: { unaffected: {}, vulnerable: {} },
        identifiers: { CWE: [], CVE: [] },
        CVSSv3: 'CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L',
        severity: 'high',
        creationTime: '2017-01-12T12:37:00.000Z',
        modificationTime: '2017-01-12T12:37:00.000Z',
        publicationTime: '2017-01-16T21:00:00.000Z',
        disclosureTime: '2017-01-11T21:00:00.000Z',
        id: 'SNYK-RUBY-NOKOGIRI-20299',
        packageName: 'nokogiri',
        cvssScore: 7.3,
        from: [ 'nokogiri@1.8.1' ],
        upgradePath: [],
        version: '1.8.1',
        name: 'nokogiri',
        isUpgradable: false,
        isPatchable: false,
      });
    }
    res.send({
      vulnerabilities: vulnerabilities,
      org: 'test-org',
      isPrivate: true,
    });
    return next();
  });

  server.post(root + '/vuln/:registry/patches', function (req, res, next) {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.put(root + '/monitor/:registry', function (req, res, next) {
    res.send({
      id: 'test',
    });
    return next();
  });

  server.setNextResponse = function (response) {
    server._nextResponse = response;
  };

  return server;
};
