import config from '../config';
import { makeRequestRest } from '../request/promise';

import {
  CreateDepGraphResponse,
  FileHashes,
  GetDepGraphResponse,
  GetIssuesResponse,
  IssuesRequestAttributes,
} from '../ecosystems/unmanaged/types';

export async function getIssues(
  issuesRequestAttributes: IssuesRequestAttributes,
  orgId: string,
): Promise<GetIssuesResponse> {
  const payload = {
    method: 'POST',
    url: `${config.API_HIDDEN_URL}/orgs/${orgId}/unmanaged_ecosystem/issues?version=2022-06-29~experimental`,
    body: issuesRequestAttributes,
  };

  return await makeRequestRest<GetIssuesResponse>(payload);
}

export async function getDepGraph(
  id: string,
  orgId: string,
): Promise<GetDepGraphResponse> {
  const payload = {
    method: 'GET',
    url: `${config.API_HIDDEN_URL}/orgs/${orgId}/unmanaged_ecosystem/depgraphs/${id}?version=2022-05-23~experimental`,
  };

  return await makeRequestRest<GetDepGraphResponse>(payload);
}

export async function createDepGraph(
  hashes: FileHashes,
  orgId: string,
): Promise<CreateDepGraphResponse> {
  const payload = {
    method: 'POST',
    url: `${config.API_HIDDEN_URL}/orgs/${orgId}/unmanaged_ecosystem/depgraphs?version=2022-05-23~experimental`,
    body: hashes,
  };

  return await makeRequestRest<CreateDepGraphResponse>(payload);
}
