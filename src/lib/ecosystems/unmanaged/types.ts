import { SEVERITY } from '../../snyk-test/common';
import { PkgInfo } from '@snyk/dep-graph';
import { UpgradePath, DepsFilePaths } from '../types';
import { SupportedProjectTypes } from '../../types';

export interface HashFormat {
  format: number;
  data: string;
}

export interface FileHash {
  size: number;
  path: string;
  hashes_ffm: HashFormat[];
}

export interface FileHashes {
  hashes: FileHash[];
}

export interface LocationResponse {
  id: string;
  location: string;
  type: string;
}

export interface JsonApi {
  version: string;
}

export interface Links {
  self: string;
}

export interface CreateDepGraphResponse {
  data: LocationResponse;
  jsonapi: JsonApi;
  links: Links;
}

export interface DepOpenApi {
  node_id: string;
}

interface NodeOpenApi {
  node_id: string;
  pkg_id: string;
  deps: DepOpenApi[];
}
export interface Details {
  artifact: string;
  version: string;
  author: string;
  path: string;
  id: string;
  url: string;
  score: string;
  filePaths: string[];
}

export interface DetailsOpenApi {
  artifact: string;
  version: string;
  author: string;
  path: string;
  id: string;
  url: string;
  score: number;
  file_paths: string[];
}

export interface ComponentDetails {
  [key: string]: Details;
}

export interface ComponentDetailsOpenApi {
  [key: string]: DetailsOpenApi;
}

export interface GraphOpenApi {
  root_node_id: string;
  nodes: NodeOpenApi[];
}

export interface Pkg {
  id: string;
  info: PkgInfo;
}

export interface PkgManager {
  name: string;
}

export interface DepGraphDataOpenAPI {
  schema_version: string;
  pkg_manager: PkgManager;
  pkgs: Pkg[];
  graph: GraphOpenApi;
}

export interface Attributes {
  start_time: number;
  dep_graph_data: DepGraphDataOpenAPI;
  component_details: ComponentDetailsOpenApi;
}

export interface IssuesRequestDetails {
  artifact: string;
  version: string;
  author: string;
  path: string;
  id: string;
  url: string;
  score: number;
  file_paths: string[];
}

export interface IssuesRequestComponentDetails {
  [key: string]: IssuesRequestDetails;
}

export interface IssuesRequestDep {
  nodeId: string;
}

export interface IssuesRequestDepOpenApi {
  node_id: string;
}

export interface IssuesRequestNode {
  nodeId: string;
  pkgId: string;
  deps: IssuesRequestDep[];
}

export interface IssuesRequestNodeOpenApi {
  node_id: string;
  pkg_id: string;
  deps: IssuesRequestDepOpenApi[];
}

export interface IssuesRequestGraph {
  rootNodeId: string;
  nodes: IssuesRequestNodeOpenApi[];
  component_details: ComponentDetails;
}

export interface IssuesRequestGraphOpenApi {
  root_node_id: string;
  nodes: IssuesRequestNodeOpenApi[];
  component_details: ComponentDetailsOpenApi;
}

export interface IssuesRequestDepGraphDataOpenAPI {
  schema_version: string;
  pkg_manager: PkgManager;
  pkgs: Pkg[];
  graph: IssuesRequestGraphOpenApi;
}

export interface IssuesRequestAttributes {
  start_time: number;
  dep_graph: IssuesRequestDepGraphDataOpenAPI;
  component_details: IssuesRequestComponentDetails;
}

export interface Data {
  id: string;
  type: string;
  attributes: Attributes;
}

export interface FileSignaturesDetailsOpenApi {
  [pkgKey: string]: {
    confidence: number;
    file_paths: string[];
  };
}

export interface FixInfoOpenApi {
  upgrade_paths: UpgradePath[];
  is_patchable: boolean;
  nearest_fixed_in_version?: string;
}

export interface IssueOpenApi {
  pkg_name: string;
  pkg_version?: string;
  issue_id: string;
  fix_info: FixInfoOpenApi;
}

export interface IssuesDataOpenApi {
  [issueId: string]: IssueDataOpenApi;
}

export interface GetDepGraphResponse {
  data: Data;
  jsonapi: JsonApi;
  links: Links;
}

export interface IssuesResponseDataResult {
  start_time: string;
  issues: IssueOpenApi[];
  issues_data: IssuesDataOpenApi;
  dep_graph: DepGraphDataOpenAPI;
  deps_file_paths: DepsFilePaths;
  file_signatures_details: FileSignaturesDetailsOpenApi;
  type: string;
}

export interface IssuesResponseData {
  id: string;
  result: IssuesResponseDataResult;
}

export interface GetIssuesResponse {
  jsonapi: JsonApi;
  links: Links;
  data: IssuesResponseData;
}

export interface GetDepGraphResponse {
  data: Data;
  jsonapi: JsonApi;
  links: Links;
}

interface PatchOpenApi {
  version: string;
  id: string;
  urls: string[];
  modification_time: string;
}

export interface IssueDataOpenApi {
  id: string;
  package_name: string;
  version: string;
  module_name?: string;
  below: string; // Vulnerable below version
  semver: {
    vulnerable: string | string[];
    vulnerable_hashes?: string[];
    vulnerable_by_distro?: {
      [distro_name_and_version: string]: string[];
    };
  };
  patches: PatchOpenApi[];
  is_new: boolean;
  description: string;
  title: string;
  severity: SEVERITY;
  fixed_in: string[];
  legal_instructions?: string;
  package_manager?: SupportedProjectTypes;
  from?: string[];
  name?: string;
  publication_time?: string;
  creation_time?: string;
  cvsSv3?: string;
  credit?: string[];
}
