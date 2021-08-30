import * as express from 'express';
import * as http from 'http';
import * as bodyParser from 'body-parser';

const featureFlagDefaults = (): Map<string, boolean> => {
  return new Map([['cliFailFast', false]]);
};

type FakeServer = {
  getRequests: () => express.Request[];
  popRequest: () => express.Request;
  popRequests: (num: number) => express.Request[];
  setDepGraphResponse: (next: Record<string, unknown>) => void;
  setNextResponse: (r: any) => void;
  setNextStatusCode: (c: number) => void;
  setFeatureFlag: (featureFlag: string, enabled: boolean) => void;
  listen: (port: string | number, callback: () => void) => void;
  restore: () => void;
  close: (callback: () => void) => void;
  getPort: () => number;
};

export const fakeServer = (basePath: string, snykToken: string): FakeServer => {
  let requests: express.Request[] = [];
  let featureFlags: Map<string, boolean> = featureFlagDefaults();
  let nextStatusCode: number | undefined = undefined;
  let nextResponse: any = undefined;
  let depGraphResponse: Record<string, unknown> | undefined = undefined;
  let server: http.Server | undefined = undefined;

  const restore = () => {
    requests = [];
    depGraphResponse = undefined;
    featureFlags = featureFlagDefaults();
  };

  const getRequests = () => {
    return requests;
  };

  const popRequest = () => {
    return requests.pop()!;
  };

  const popRequests = (num: number) => {
    return requests.splice(requests.length - num, num);
  };

  const setDepGraphResponse = (next: typeof depGraphResponse) => {
    depGraphResponse = next;
  };

  const setNextResponse = (response: string | Record<string, unknown>) => {
    if (typeof response === 'string') {
      nextResponse = JSON.parse(response);
      return;
    }
    nextResponse = response;
  };

  const setNextStatusCode = (code: number) => {
    nextStatusCode = code;
  };

  const setFeatureFlag = (featureFlag: string, enabled: boolean) => {
    featureFlags.set(featureFlag, enabled);
  };

  const app = express();
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use((req, res, next) => {
    requests.push(req);
    next();
  });

  [basePath + '/verify/callback', basePath + '/verify/token'].map((url) => {
    app.post(url, (req, res) => {
      if (req.body.api === snykToken) {
        return res.send({
          ok: true,
          api: snykToken,
        });
      }

      if (req.body.token) {
        return res.send({
          ok: true,
          api: snykToken,
        });
      }

      res.status(401);
      res.send({
        ok: false,
      });
    });
  });

  app.use((req, res, next) => {
    // these test don't run on the new experimental flow
    // so once we deprecate legacy this check can be removed
    const isExperimentalIac =
      req.url !== undefined &&
      (req.url.includes('/iac-org-settings') ||
        req.url.includes('/feature-flags/experimentalLocalExecIac'));
    if (
      isExperimentalIac ||
      req.url?.includes('/cli-config/feature-flags/') ||
      (!nextResponse && !nextStatusCode)
    ) {
      return next();
    }
    const response = nextResponse;
    nextResponse = undefined;
    if (nextStatusCode) {
      const code = nextStatusCode;
      nextStatusCode = undefined;
      res.status(code);
    }
    res.send(response);
  });

  app.get(basePath + '/vuln/:registry/:module', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  app.post(basePath + '/vuln/:registry', (req, res, next) => {
    const vulnerabilities = [];
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage:
          'Org missing-org was not found or you may not have the correct permissions',
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

  app.post(basePath + '/vuln/:registry/patches', (req, res, next) => {
    res.send({
      vulnerabilities: [],
    });
    return next();
  });

  app.post(basePath + '/test-dep-graph', (req, res, next) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404);
      res.send({
        code: 404,
        userMessage:
          'Org missing-org was not found or you may not have the correct permissions',
      });
      return next();
    }

    if (depGraphResponse) {
      res.send(depGraphResponse);
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

  app.post(basePath + '/docker-jwt/test-dependencies', (req, res, next) => {
    if (
      req.headers.authorization &&
      !req.headers.authorization.includes('Bearer')
    ) {
      res.status(401).send();
      return;
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

  app.post(basePath + '/test-dependencies', (req, res) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404).send({
        code: 404,
        userMessage:
          'Org missing-org was not found or you may not have the correct permissions',
      });
      return;
    }

    let dockerResults = {};
    // To check --exclude-base-image-vulns
    if (req.body.scanResult.target.image === 'docker-image|alpine') {
      dockerResults = {
        baseImage: 'something:0.0.1',
        baseImageRemediation: {
          advice: [],
          code: 'REMEDIATION_AVAILABLE',
        },
        binariesVulns: {
          affectedPkgs: {
            'node/5.10.1': {
              pkg: {
                version: '5.10.1',
                name: 'node',
              },
              issues: {
                'SNYK-UPSTREAM-BZIP2-106947': {
                  issueId: 'SNYK-UPSTREAM-BZIP2-106947',
                  fixInfo: {
                    upgradePaths: [],
                    isPatchable: false,
                    nearestFixedInVersion: '5.13.1',
                  },
                },
              },
            },
          },
          issuesData: {
            'SNYK-UPSTREAM-BZIP2-106947': {
              id: 'SNYK-UPSTREAM-NODE-72359',
              severity: 'high',
            },
          },
        },
      };
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
        docker: dockerResults,
      },
      meta: {
        org: 'test-org',
        isPublic: false,
      },
    });
  });

  app.put(basePath + '/monitor-dependencies', (req, res) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404).send({
        code: 404,
        userMessage:
          'Org missing-org was not found or you may not have the correct permissions',
      });
      return;
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
  });

  app.post(basePath + '/test-iac', (req, res) => {
    if (req.query.org && req.query.org === 'missing-org') {
      res.status(404).send({
        code: 404,
        userMessage:
          'Org missing-org was not found or you may not have the correct permissions',
      });
      return;
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
  });

  app.get(basePath + '/cli-config/feature-flags/:featureFlag', (req, res) => {
    const org = req.query.org;
    const flag = req.params.featureFlag;
    const disabled = new Set(['optOutFromLocalExecIac']);
    if (org === 'no-flag' || disabled.has(flag)) {
      res.send({
        ok: false,
        userMessage: `Org ${org} doesn't have '${flag}' feature enabled'`,
      });
      return;
    }

    if (featureFlags.has(flag)) {
      const ffEnabled = featureFlags.get(flag);
      if (ffEnabled) {
        res.send({
          ok: true,
        });
      } else {
        res.send({
          ok: false,
          userMessage: `Org ${org} doesn't have '${flag}' feature enabled'`,
        });
      }
      return;
    }

    // default: return true for all feature flags
    res.send({
      ok: true,
    });
  });

  app.get(basePath + '/iac-org-settings', (req, res) => {
    res.status(200).send({
      meta: {
        isPrivate: false,
        isLicensesEnabled: false,
        ignoreSettings: null,
        org: req.query.org || 'test-org',
      },
      customPolicies: {},
    });
  });

  app.get(basePath + '/authorization/:action', (req, res, next) => {
    res.send({ result: { allowed: true } });
    return next();
  });

  app.put(basePath + '/monitor/:registry/graph', (req, res, next) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/graph/some/project-id`,
      isMonitored: true,
    });
    return next();
  });

  app.put(basePath + '/monitor/:registry', (req, res) => {
    res.send({
      id: 'monitor',
      uri: `${req.params.registry}/some/project-id`,
      isMonitored: true,
    });
  });

  app.post(basePath + '/track-iac-usage/cli', (req, res) => {
    res.status(200).send({});
  });

  app.post(basePath + '/analytics/cli', (req, res) => {
    res.status(200).send({});
  });

  const listen = (port: string | number, callback: () => void) => {
    server = app.listen(Number(port), callback);
  };

  const close = (callback: () => void) => {
    if (!server) {
      callback();
      return;
    }
    server.close(callback);
    server = undefined;
  };

  const getPort = () => {
    const address = server?.address();
    if (address && typeof address === 'object') {
      return address.port;
    }
    throw new Error('port not found');
  };

  return {
    getRequests,
    popRequest,
    popRequests,
    setDepGraphResponse,
    setNextResponse,
    setNextStatusCode,
    setFeatureFlag,
    listen,
    restore,
    close,
    getPort,
  };
};
