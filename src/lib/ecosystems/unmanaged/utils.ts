import * as camelCase from 'lodash.camelcase';
import { DepGraphData } from '@snyk/dep-graph';
import { GraphNode } from '@snyk/dep-graph/dist/core/types';
import { getAuthHeader } from '../../api-token';
import { isCI } from '../../is-ci';
import { makeRequest } from '../../request';
import config from '../../config';

function mapKey(object, iteratee) {
  object = Object(object);
  const result = {};

  Object.keys(object).forEach((key) => {
    const value = object[key];
    result[iteratee(value, key, object)] = value;
  });
  return result;
}

export function convertToCamelCase<T>(obj: any): T {
  return mapKey(obj as Object, (_, key) => camelCase(key)) as any;
}

export function convertMapCasing<T>(obj: any): T {
  const newObj = {} as T;

  for (const [key, data] of Object.entries(obj)) {
    newObj[key] = convertToCamelCase(data);
  }
  return newObj;
}

export function convertObjectArrayCasing<T>(arr: any[]): T[] {
  return arr.map((item) => convertToCamelCase<T>(item));
}

export function convertDepGraph<T>(depGraphOpenApi: T) {
  const depGraph: DepGraphData = convertToCamelCase(depGraphOpenApi);
  depGraph.graph = convertToCamelCase(depGraph.graph);
  const nodes: GraphNode[] = depGraph.graph.nodes.map((graphNode) => {
    const node: GraphNode = convertToCamelCase(graphNode);
    node.deps = node.deps.map((dep) => convertToCamelCase(dep));
    return node;
  });

  depGraph.graph.nodes = nodes;
  return depGraph;
}

export function getSelf() {
  return makeSelfRequest().then((res: any) => {
    const response = JSON.parse(res.body);
    return response?.data?.attributes;
  });
}

export function makeSelfRequest() {
  const payload = {
    method: 'GET',
    url: `${config.API_REST_URL}/self?version=2022-08-12~experimental`,
    json: true,
    headers: {
      'x-is-ci': isCI(),
      authorization: getAuthHeader(),
    },
  };

  return new Promise((resolve, reject) => {
    makeRequest(payload, (error, res, body) => {
      if (error) {
        return reject(error);
      }

      resolve({
        res,
        body,
      });
    });
  });
}
