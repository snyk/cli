import * as restify from 'restify';

interface FakeServer extends restify.Server {
  _reqLog: restify.Request[];
  _nextResponse?: restify.Response;
  _nextStatusCode?: number;
  popRequest: () => restify.Request;
  popRequests: (num: number) => restify.Request[];
  setNextResponse: (r: any) => void;
  setNextStatusCodeAndResponse: (c: number, r: any) => void;
}

export function fakeServer(root, apikey) {
  const server = restify.createServer({
    name: 'snyk-mock-server',
    version: '1.0.0',
    handleUncaughtExceptions: true,
  }) as FakeServer;
  server._reqLog = [];
  server.popRequest = () => {
    return server._reqLog.pop()!;
  };
  server.popRequests = (num: number) => {
    return server._reqLog.splice(server._reqLog.length - num, num);
  };
  server.use(restify.plugins.acceptParser(server.acceptable));
  server.use(restify.plugins.queryParser({ mapParams: true }));
  server.use(restify.plugins.bodyParser({ mapParams: true }));
  server.use(function logRequest(req, res, next) {
    server._reqLog.push(req);
    next();
  });

  [root + '/verify/callback', root + '/verify/token'].map((url) => {
    server.post(url, (req, res) => {
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

  server.use((req, res, next) => {
    // these test don't run on the new experimental flow
    // so once we deprecate legacy this check can be removed
    const isExperimentalIac =
      req.url !== undefined &&
      (req.url.includes('/iac-org-settings') ||
        req.url.includes('/feature-flags/experimentalLocalExecIac'));
    if (
      isExperimentalIac ||
      (!server._nextResponse && !server._nextStatusCode)
    ) {
      return next();
    }
    const response = server._nextResponse;
    delete server._nextResponse;
    if (server._nextStatusCode) {
      const code = server._nextStatusCode;
      delete server._nextStatusCode;
      res.send(code, response);
    } else {
      res.send(response);
    }
  });

  server.get(root + '/vuln/:registry/:module', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/vuln/:registry', (req, res, next) => {
    const vulnerabilities = [];
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }
    res.send({
      vulnerabilities,
      org: 'test-org',
      isPrivate: true,
    });
    return next();
  });

  server.post(root + '/vuln/:registry/patches', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  server.post(root + '/test-dep-graph', (req, res, next) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }

    res.send({
      result: {
        issuesData: {},
        affectedPkgs: {},
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
    return next();
  });

  server.post(root + '/docker-jwt/test-dependencies', (req, res, next) => {
    if (
      req.headers.authorization &&
      !req.headers.authorization.includes('Bearer')
    ) {
      res.send(401);
    }

    res.send({
      result: {
        issues: [],
        issuesData: {},
        depGraphData: {
          schemaVersion: '1.2.0',
          pkgManager: {
            name: 'rpm',
            repositories: [{ alias: 'rhel:8.2' }],
          },
          pkgs: [
            {
              id: 'docker-image|foo@1.2.3',
              info: {
                name: 'docker-image|foo',
                version: '1.2.3',
              },
            },
          ],
          graph: {
            rootNodeId: 'root-node',
            nodes: [
              {
                nodeId: 'root-node',
                pkgId: 'docker-image|foo@1.2.3',
                deps: [],
              },
            ],
          },
        },
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
    return next();
  });

  server.post(root + '/test-dependencies', (req, res, next) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }

    res.send({
      result: {
        issues: [],
        issuesData: {},
        depGraphData: {
          schemaVersion: '1.2.0',
          pkgManager: {
            name: 'rpm',
            repositories: [{ alias: 'rhel:8.2' }],
          },
          pkgs: [
            {
              id: 'docker-image|foo@1.2.3',
              info: {
                name: 'docker-image|foo',
                version: '1.2.3',
              },
            },
          ],
          graph: {
            rootNodeId: 'root-node',
            nodes: [
              {
                nodeId: 'root-node',
                pkgId: 'docker-image|foo@1.2.3',
                deps: [],
              },
            ],
          },
        },
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
    return next();
  });

  server.put(root + '/monitor-dependencies', (req, res, next) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }

    res.send({
      ok: true,
      org: 'test-org',
      id: 'project-public-id',
      isMonitored: true,
      trialStarted: true,
      licensesPolicy: {},
      uri:
        'http://example-url/project/project-public-id/history/snapshot-public-id',
      projectName: 'test-project',
    });
    return next();
  });

  server.post(root + '/test-iac', (req, res, next) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage: 'cli error message',
      });
      return next();
    }

    res.send({
      result: {
        projectType: 'k8sconfig',
        cloudConfigResults: [],
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
    return next();
  });

  server.get(
    root + '/cli-config/feature-flags/:featureFlag',
    (req, res, next) => {
      const org = req.params.org;
      const flag = req.params.featureFlag;
      const disabled = new Set(['optOutFromLocalExecIac']);
      if (org === 'no-flag' || disabled.has(flag)) {
        res.send({
          ok: false,
          userMessage: `Org ${org} doesn't have '${flag}' feature enabled'`,
        });
        return next();
      }
      res.send({
        ok: true,
      });
      return next();
    },
  );

  server.get(root + '/iac-org-settings', (req, res, next) => {
    res.status(200);
    res.send({
      meta: {
        isPrivate: false,
        isLicensesEnabled: false,
        ignoreSettings: null,
        org: 'test-org',
      },
      customPolicies: {},
    });
    return next();
  });

  server.get(root + '/authorization/:action', (req, res, next) => {
    res.send({ result: { allowed: true } });
    return next();
  });

  server.put(root + '/monitor/:registry/graph', (req, res, next) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/graph/some/project-id`,
      isMonitored: true,
    });
    return next();
  });

  server.put(root + '/monitor/:registry', (req, res, next) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/some/project-id`,
      isMonitored: true,
    });
    return next();
  });

  server.setNextResponse = (response) => {
    server._nextResponse = response;
  };

  server.setNextStatusCodeAndResponse = (code, body) => {
    server._nextStatusCode = code;
    server._nextResponse = body;
  };

  return server;
}
