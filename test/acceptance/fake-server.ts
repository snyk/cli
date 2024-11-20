import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as path from 'path';
import * as net from 'net';
import { getFixturePath } from '../jest/util/getFixturePath';
import * as os from 'os';

const featureFlagDefaults = (): Map<string, boolean> => {
  return new Map([
    ['cliFailFast', false],
    ['iacIntegratedExperience', false],
    ['iacNewEngine', false],
    ['containerCliAppVulnsEnabled', true],
    ['enablePnpmCli', false],
  ]);
};

export function getFirstIPv4Address(): string {
  let ipaddress = '';

  const interfaces = os.networkInterfaces();
  for (const [, group] of Object.entries(interfaces)) {
    if (group) {
      for (const inter of group) {
        if (inter && inter.family == 'IPv4' && inter.address != '127.0.0.1') {
          ipaddress = inter.address;
          break;
        }
      }
    }
  }
  return ipaddress;
}

export type FakeServer = {
  getRequests: () => express.Request[];
  popRequest: () => express.Request;
  popRequests: (num: number) => express.Request[];
  setCustomResponse: (next: Record<string, unknown>) => void;
  setSarifResponse: (next: Record<string, unknown>) => void;
  setNextResponse: (r: any) => void;
  setNextStatusCode: (c: number) => void;
  setStatusCode: (c: number) => void;
  setStatusCodes: (c: number[]) => void;
  setLocalCodeEngineConfiguration: (next: Record<string, unknown>) => void;
  setFeatureFlag: (featureFlag: string, enabled: boolean) => void;
  setOrgSetting: (setting: string, enabled: boolean) => void;
  unauthorizeAction: (action: string, reason?: string) => void;
  listen: (port: string | number, callback: () => void) => void;
  listenPromise: (port: string | number) => Promise<void>;
  listenWithHttps: (
    port: string | number,
    options: https.ServerOptions,
  ) => Promise<void>;
  restore: () => void;
  close: (callback: () => void) => void;
  closePromise: () => Promise<void>;
  getPort: () => number;
};

export const fakeServer = (basePath: string, snykToken: string): FakeServer => {
  let requests: express.Request[] = [];
  let featureFlags: Map<string, boolean> = featureFlagDefaults();
  let availableSettings: Map<string, boolean> = new Map();
  let localCodeEngineConfiguration: Record<string, unknown> = {
    enabled: false,
  };
  let unauthorizedActions = new Map();
  // the status code to return for the next request, overriding statusCode
  let nextStatusCode: number | undefined = undefined;
  // the status code to return for all the requests
  let statusCode: number | undefined = undefined;
  let statusCodes: number[] = [];
  let nextResponse: any = undefined;
  let customResponse: Record<string, unknown> | undefined = undefined;
  let sarifResponse: Record<string, unknown> | undefined = undefined;
  let server: http.Server | undefined = undefined;
  const sockets = new Set();

  const restore = () => {
    statusCode = undefined;
    requests = [];
    customResponse = undefined;
    sarifResponse = undefined;
    featureFlags = featureFlagDefaults();
    availableSettings = new Map();
    unauthorizedActions = new Map();
  };

  const getRequests = () => {
    return requests;
  };

  const popRequest = () => {
    const request = requests?.pop();
    if (request) return request;
    else throw new Error('No request found in requests array');
  };

  const popRequests = (num: number) => {
    return requests.splice(requests.length - num, num);
  };

  const setCustomResponse = (next: typeof customResponse) => {
    customResponse = next;
  };

  const setSarifResponse = (next: typeof sarifResponse) => {
    sarifResponse = next;
  };

  const setLocalCodeEngineConfiguration = (
    response: string | Record<string, unknown>,
  ) => {
    if (typeof response === 'string') {
      localCodeEngineConfiguration = JSON.parse(response);
      return;
    }
    localCodeEngineConfiguration = response;
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

  const setStatusCode = (code: number) => {
    statusCode = code;
  };

  const setStatusCodes = (codes: number[]) => {
    statusCodes = codes;
  };

  const setFeatureFlag = (featureFlag: string, enabled: boolean) => {
    featureFlags.set(featureFlag, enabled);
  };

  const setOrgSetting = (setting: string, enabled: boolean) => {
    availableSettings.set(setting, enabled);
  };

  const unauthorizeAction = (
    action: string,
    reason = 'unauthorized by test',
  ) => {
    unauthorizedActions.set(action, {
      allowed: false,
      reason,
    });
  };

  const app = express();
  app.use(bodyParser.json({ limit: '50mb' }));
  // Content-Type for rest API endpoints is 'application/vnd.api+json'
  app.use(express.json({ type: 'application/vnd.api+json', strict: false }));
  app.use((req, res, next) => {
    requests.push(req);
    next();
  });

  [basePath + '/verify/callback', basePath + '/verify/token'].map((url) => {
    app.post(url, (req, res) => {
      if (req.header('Authorization') === undefined) {
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
      }

      res.status(401);
      res.send({
        ok: false,
      });
    });
  });

  app.get('/login', (req, res) => {
    res.status(200);
    res.send('Test Authenticated!');
  });

  app.use((req, res, next) => {
    if (
      req.url?.includes('/iac-org-settings') ||
      req.url?.includes('/cli-config/feature-flags/') ||
      (!nextResponse && !nextStatusCode && !statusCode)
    ) {
      return next();
    }
    const response = nextResponse;
    nextResponse = undefined;
    if (nextStatusCode) {
      const code = nextStatusCode;
      nextStatusCode = undefined;
      res.status(code);
    } else if (statusCode) {
      res.status(statusCode);
    }

    res.send(response);
  });

  app.get(basePath + '/vuln/:registry/:module', (req, res) => {
    try {
      // Use one of the fixtures if it exists.
      const body = fs.readFileSync(
        path.resolve(getFixturePath('cli-test-results'), req.params.module),
        'utf8',
      );
      res.send(JSON.parse(body));
    } catch {
      res.send({
        vulnerabilities: [],
      });
    }
  });

  // needed for code-client-go
  app.get('/deeproxy/filters', (req, res) => {
    res.status(200);
    if (customResponse) {
      res.send(customResponse);
    }
    res.send({});
  });

  // needed for code-client-go
  app.post('/deeproxy/bundle', (req, res) => {
    res.status(200);
    res.send({
      bundleHash:
        'faa6b7161c14f933ef4ca79a18ad9283eab362d5e6d3a977125eb95b37c377d8',
      missingFiles: [],
    });
  });

  // needed for code-client-go
  app.post(`/api/rest/orgs/:orgId/scans`, (req, res) => {
    res.status(201);
    res.send({ data: { id: 'a6fb2742-b67f-4dc3-bb27-42b67f1dc344' } });
  });

  // needed for code-client-go
  app.get(`/api/rest/orgs/:orgId/scans/:id`, (req, res) => {
    res.status(200);
    res.send({
      data: {
        attributes: {
          status: 'done',
          components: [
            { findings_url: 'http://localhost:12345/api/code_mock_stream' },
          ],
        },
        id: 'a6fb2742-b67f-4dc3-bb27-42b67f1dc344',
      },
    });
  });

  app.get(`/api/code_mock_stream`, (req, res) => {
    res.status(200);

    if (sarifResponse) {
      res.send(sarifResponse);
      return;
    }

    res.send({
      $schema:
        'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: {
            driver: {
              name: 'SnykCode',
              semanticVersion: '1.0.0',
              version: '1.0.0',
              rules: [],
            },
          },
          results: [
            {
              ruleId: 'javascript/DisablePoweredBy',
              ruleIndex: 1,
              level: 'warning',
            },
          ],
          properties: {
            coverage: [
              {
                files: 8,
                isSupported: true,
                lang: 'JavaScript',
              },
              {
                files: 1,
                isSupported: true,
                lang: 'HTML',
              },
            ],
          },
        },
      ],
    });
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

    const statusCode = statusCodes.shift();
    if (statusCode && statusCode !== 200) {
      res.sendStatus(statusCode);
      return next();
    }

    if (customResponse) {
      res.send(customResponse);
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

    if (customResponse) {
      res.send(customResponse);
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
      uri: 'http://example-url/project/project-public-id/history/snapshot-public-id',
      projectName: 'test-project',
    });
  });

  app.get(basePath + '/cli-config/settings/:setting', (req, res) => {
    const org = req.query.org;
    const setting = req.params.setting;
    if (org === 'no-flag') {
      res.send({
        ok: false,
        userMessage: `Org ${org} doesn't have '${setting}' feature enabled'`,
      });
      return;
    }

    if (availableSettings.has(setting)) {
      const settingEnabled = availableSettings.get(setting);
      // TODO: Refactor to support passing in an org setting with additional
      // properties, e.g. localCodeEngine.
      if (settingEnabled && setting === 'sast') {
        return res.send({
          ok: true,
          sastEnabled: true,
          localCodeEngine: localCodeEngineConfiguration,
        });
      }

      return res.send({
        ok: false,
        userMessage: `Org ${org} doesn't have '${setting}' feature enabled'`,
      });
    }

    // default: return false for all feature flags
    res.send({
      ok: false,
    });
  });

  app.get(basePath + '/cli-config/feature-flags/:featureFlag', (req, res) => {
    const org = req.query.org;
    const flag = req.params.featureFlag;
    if (org === 'no-flag') {
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
    const baseResponse = {
      meta: {
        isPrivate: false,
        isLicensesEnabled: false,
        ignoreSettings: null,
        org: req.query.org || 'test-org',
      },
      customPolicies: {},
      customRules: {},
      entitlements: {
        infrastructureAsCode: true,
        iacCustomRulesEntitlement: true,
        iacDrift: true,
      },
    };

    if (req.query.org === 'no-iac-entitlements') {
      return res.status(200).send({
        ...baseResponse,
        entitlements: {
          ...baseResponse.entitlements,
          infrastructureAsCode: false,
        },
      });
    }

    if (req.query.org === 'no-custom-rules-entitlements') {
      return res.status(200).send({
        ...baseResponse,
        entitlements: {
          ...baseResponse.entitlements,
          iacCustomRulesEntitlement: false,
        },
      });
    }

    if (req.query.org === 'no-iac-drift-entitlements') {
      return res.status(200).send({
        ...baseResponse,
        entitlements: {
          ...baseResponse.entitlements,
          iacDrift: false,
        },
      });
    }

    if (req.query.org === 'custom-policies') {
      return res.status(200).send({
        ...baseResponse,
        customPolicies: {
          'SNYK-CC-AZURE-543': { severity: 'none' },
        },
      });
    }

    res.status(200).send(baseResponse);
  });

  app.get(basePath + '/authorization/:action', (req, res) => {
    const result = unauthorizedActions.get(req.params.action) || {
      allowed: true,
      reason: 'Default fake server response.',
    };
    res.send({ result });
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

  // Apps endpoint
  app.post(`${basePath}/orgs/:orgId/apps`, (req, res) => {
    const { orgId } = req.params;
    const name = req.body.name;
    const redirect_uris = req.body.redirect_uris;
    const scopes = req.body.scopes;
    res.send(
      JSON.stringify({
        jsonapi: {
          version: '1.0',
        },
        data: {
          type: 'app',
          id: '84144c1d-a491-4fe5-94d1-ba143ba71b6d',
          attributes: {
            name,
            client_id: '9f26c6c6-e04b-4310-8ce4-c3a6289d0633',
            redirect_uris,
            scopes,
            is_public: false,
            client_secret: 'super-secret-client-secret',
            access_token_ttl_seconds: 3600,
          },
          links: {
            self: `/orgs/${orgId}/apps?version=2022-03-11~experimental`,
          },
        },
      }),
    );
  });

  app.post(basePath + '/track-iac-usage/cli', (req, res) => {
    res.status(200).send({});
  });

  app.post(basePath + '/iac-cli-share-results', (req, res) => {
    res.status(200).send({});
  });

  app.post(basePath + '/analytics/cli', (req, res) => {
    res.status(200).send({});
  });

  app.post(
    basePath.replace('v1', 'hidden') + `/orgs/:orgId/analytics`,
    (req, res) => {
      res.status(201).send({});
    },
  );

  // needed for code-client-go
  app.post(
    basePath.replace('v1', 'hidden') + `/orgs/:orgId/workspaces`,
    (req, res) => {
      res.status(201).send({});
    },
  );

  app.post(`/rest/orgs/:orgId/sbom_tests`, (req, res) => {
    let testId = '4b341b8a-4697-4e35-928b-4b9ae37f8ea8';

    if (req.body.data.attributes.sbom.bomFormat !== 'CycloneDX') {
      testId = '162c313c-b241-4f14-8579-618e9fa4c0e7';
    }

    const response = {
      data: {
        id: testId,
        type: 'sbom_tests',
      },
      jsonapi: {
        version: '1.0',
      },
      links: {
        self: '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/sbom_tests?version=2023-08-31~beta',
        related:
          '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/sbom_tests/4b341b8a-4697-4e35-928b-4b9ae37f8ea8?version=2023-08-31~beta',
      },
    };
    res.status(201);
    res.send(response);
  });

  app.get(`/rest/orgs/:orgId/sbom_tests/:id`, (req, res) => {
    if (req.params.id === '162c313c-b241-4f14-8579-618e9fa4c0e7') {
      res.status(422).send({
        jsonapi: { version: '1.0' },
        errors: [
          {
            id: 'f189ac86-c123-4f30-ab32-f93a1477e47f',
            title: 'Unknown SBOM format',
            status: '422',
            code: 'SNYK-SBOM-0006',
            meta: {
              classification: 'UNSUPPORTED',
              isErrorCatalogError: true,
            },
            links: {
              about:
                'https://docs.snyk.io/scan-with-snyk/error-catalog#snyk-sbom-0006',
            },
            source: {},
          },
        ],
      });
    } else {
      res.status(303).send({
        jsonapi: { version: '1.0' },
        data: {
          id: '4b341b8a-4697-4e35-928b-4b9ae37f8ea8',
          type: 'sbom_tests',
          attributes: {
            status: 'finished',
          },
        },
        links: {
          self: '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/sbom_tests/4b341b8a-4697-4e35-928b-4b9ae37f8ea8?version=2023-08-31~beta',
          related:
            '/rest/orgs/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/sbom_tests/4b341b8a-4697-4e35-928b-4b9ae37f8ea8/results?version=2023-08-31~beta',
        },
      });
    }
  });

  app.get(`/rest/orgs/:orgId/sbom_tests/:id/results`, (req, res) => {
    const body = fs.readFileSync(
      path.resolve(getFixturePath('sbom'), 'npm-sbom-test-response.json'),
      'utf8',
    );
    res.send(JSON.parse(body));
  });

  app.post(
    basePath.replace('v1', 'hidden') + '/orgs/:org/sbom',
    express.json(),
    (req, res) => {
      const depGraph: void | Record<string, any> = req.body.depGraph;
      const depGraphs: void | Record<string, any>[] = req.body.depGraphs;
      const tools = req.body.tools || [];
      let name = '';
      let components;

      let bom: Record<string, any> = { bomFormat: 'CycloneDX' };

      interface dependency {
        ref: string;
        dependsOn: string[];
      }

      const dependencies: dependency[] = [];

      const addDependencies = (
        nodeIdMap: { [key: string]: string },
        element: any,
      ) => {
        dependencies.push({
          ref: element.pkgId,
          dependsOn: element.deps.map((d: any) => nodeIdMap[d.nodeId]),
        });
      };

      if (Array.isArray(depGraphs) && req.body.subject) {
        // Return a fixture of an all-projects SBOM.
        name = req.body.subject.name;
        components = depGraphs
          .flatMap(({ pkgs }) => pkgs)
          .map(({ info: { name } }) => ({ name }));

        const nodeIdMap: { [key: string]: string } = {};

        depGraphs.forEach((g: any) => {
          g.graph.nodes.forEach((element: any) => {
            nodeIdMap[element.nodeId] = element.pkgId;
          });
        });

        depGraphs.forEach((g: any) => {
          g.graph.nodes.forEach((e: any) => addDependencies(nodeIdMap, e));
        });
      } else if (depGraph) {
        name = depGraph.pkgs[0]?.info.name;
        components = depGraph.pkgs.map(({ info: { name } }) => ({ name }));

        const nodeIdMap: { [key: string]: string } = {};

        depGraph.graph.nodes.forEach((element: any) => {
          nodeIdMap[element.nodeId] = element.pkgId;
        });

        depGraph.graph.nodes.forEach((e: any) => addDependencies(nodeIdMap, e));
      }

      switch (req.query.format) {
        case 'spdx2.3+json':
          bom = {
            spdxVersion: 'SPDX-2.3',
            name,
            packages: components,
            creators: [...tools, 'fake-server'],
          };
          break;
        case 'cyclonedx1.4+json':
          bom = {
            specVersion: '1.4',
            $schema: 'http://cyclonedx.org/schema/bom-1.4.schema.json',
            components,
            dependencies: dependencies,
            metadata: {
              component: { name },
              tools: [...tools, { name: 'fake-server', version: '42' }],
            },
          };
          break;
        case 'cyclonedx1.5+json':
          bom = {
            specVersion: '1.5',
            $schema: 'http://cyclonedx.org/schema/bom-1.5.schema.json',
            components,
            metadata: {
              component: { name },
              tools: {
                components: [...tools, { name: 'fake-server' }],
                services: [{ name: 'fake-server', version: '42' }],
              },
            },
          };
          break;
        case 'cyclonedx1.6+json':
          bom = {
            specVersion: '1.6',
            $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
            components,
            metadata: {
              component: { name },
              tools: {
                components: [...tools, { name: 'fake-server' }],
                services: [{ name: 'fake-server', version: '42' }],
              },
            },
          };
          break;
      }

      res.status(200).send(bom);
    },
  );

  app.get(basePath + '/download/driftctl', (req, res) => {
    const fixturePath = getFixturePath('iac');
    const path1 = path.join(fixturePath, 'drift', 'download-test.sh');
    const body = fs.readFileSync(path1);
    res.send(body);
  });

  // Post state mapping artifact
  app.post(
    basePath.replace('v1', 'hidden') +
      '/orgs/:orgId/cloud/mappings_artifact/tfstate',
    (req, res) => {
      const { orgId } = req.params;
      const artifact = path.join(
        getFixturePath('iac'),
        'capture',
        orgId + '-artifact.json',
      );
      fs.writeFileSync(artifact, JSON.stringify(req.body));
      res.status(201).send({});
    },
  );

  app.post(basePath.replace('/v1', '') + '/oauth2/token', (req, res) => {
    const fake_oauth_token =
      '{"access_token":"access_token_value","token_type":"b","expiry":"3023-12-20T08:49:15.504539Z"}';

    // client credentials grant: expecting client id = a and client secret = b
    if (req.headers.authorization?.includes('Basic YTpi')) {
      res.status(200).send(fake_oauth_token);
      return;
    }

    res.status(401).send({});
  });

  const listenPromise = (port: string | number) => {
    return new Promise<void>((resolve) => {
      server = http.createServer(app).listen(Number(port), resolve);

      server?.on('connection', (socket) => {
        sockets.add(socket);
      });
    });
  };

  const listen = (port: string | number, callback: () => void) => {
    listenPromise(port).then(callback);
  };

  const listenWithHttps = (
    port: string | number,
    options: https.ServerOptions,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      server = https.createServer(options, app);
      server.once('listening', () => {
        resolve();
      });
      server.once('error', (err) => {
        reject(err);
      });
      server.listen(Number(port));
    });
  };

  const closePromise = () => {
    return new Promise<void>((resolve) => {
      if (!server) {
        resolve();
        return;
      }
      server.close(() => resolve());
      server = undefined;
    });
  };

  const close = (callback: () => void) => {
    for (const socket of sockets) {
      (socket as net.Socket)?.destroy();
      sockets.delete(socket);
    }

    closePromise().then(callback);
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
    setCustomResponse,
    setSarifResponse,
    setLocalCodeEngineConfiguration,
    setNextResponse,
    setNextStatusCode,
    setStatusCode,
    setStatusCodes,
    setFeatureFlag,
    setOrgSetting,
    unauthorizeAction,
    listen,
    listenPromise,
    listenWithHttps,
    restore,
    close,
    closePromise,
    getPort,
  };
};
