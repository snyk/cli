import { tmpdir } from 'os';
import { join } from 'path';
import { mkdir, readFileSync } from 'fs';
import graphlib from '@snyk/graphlib';
import { CallGraph } from '@snyk/cli-interface/legacy/common';

export function silenceLog() {
  const old = console.log;
  console.log = () => {
    return;
  };
  return () => {
    console.log = old;
  };
}

export function extendExpiries(policy) {
  const d = new Date(Date.now() + 1000 * 60 * 60 * 24).toJSON();
  Object.keys(policy.ignore).forEach((id) => {
    policy.ignore[id].forEach((rule) => {
      const path = Object.keys(rule).shift();
      if (path) {
        rule[path].expires = d;
      }
    });
  });
}

export async function makeDirectory(path: string): Promise<string> {
  return await new Promise((resolve, reject) => {
    mkdir(path, (err) => {
      if (err) {
        reject(err);
      }
      resolve(path);
    });
  });
}

export async function makeTmpDirectory(): Promise<string> {
  const dirname = join(
    tmpdir(),
    'TMP' +
      Math.random()
        .toString(36)
        .replace(/[^a-z0-9]+/g, '')
        .substr(2, 12),
  );
  return makeDirectory(dirname);
}

export function loadJson(filename: string) {
  return JSON.parse(readFileSync(filename, 'utf-8'));
}

export function createCallGraph(callGraphPayload: any): CallGraph {
  return graphlib.json.read(callGraphPayload);
}
