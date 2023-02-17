import * as camelCase from 'lodash.camelcase';
import { DepGraphData } from '@snyk/dep-graph';
import { GraphNode } from '@snyk/dep-graph/dist/core/types';
import config from '../../config';
import { makeRequestRest } from '../../request/promise';
import { pollDepGraphAttributes, submitHashes } from '../resolve-test-facts';
import { ScanResult } from '../types';
import { DepGraphDataOpenAPI } from './types';

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

interface SelfResponse {
  jsonapi: {
    version: string;
  };
  data: {
    type: string;
    id: string;
    attributes: {
      name: string;
      username: string;
      email: string;
      avatar_url: string;
      default_org_context: string;
    };
    links: {
      self: string;
    };
  };
}

export function getSelf() {
  return makeRequestRest<SelfResponse>({
    method: 'GET',
    url: `${config.API_REST_URL}/self?version=2022-08-12~experimental`,
  });
}

export async function getUnmanagedDepGraph(scans: {
  [dir: string]: ScanResult[];
}) {
  const results: DepGraphDataOpenAPI[] = [];
  const orgId = (await getSelf())?.data.attributes.default_org_context;

  for (const [, scanResults] of Object.entries(scans)) {
    for (const scanResult of scanResults) {
      const taskId = await submitHashes(
        { hashes: scanResult?.facts[0]?.data },
        orgId,
      );

      const { dep_graph_data } = await pollDepGraphAttributes(taskId, orgId);

      if (dep_graph_data) {
        results.push(dep_graph_data);
      }
    }
  }

  return results;
}
