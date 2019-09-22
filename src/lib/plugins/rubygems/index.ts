import { inspectors, Spec } from './inspectors';
import { MissingTargetFileError } from '../../errors/missing-targetfile-error';
import gemfileLockToDependencies = require('./gemfile-lock-to-dependencies');
import _ = require('lodash');
import { MultiProjectResult } from '@snyk/cli-interface/legacy/plugin';

export async function inspect(
  root: string,
  targetFile: string,
): Promise<MultiProjectResult> {
  if (!targetFile) {
    throw MissingTargetFileError(root);
  }
  const specs = await gatherSpecs(root, targetFile);
  const gemfileLockBase64 = _.get(specs, 'files.gemfileLock.contents');
  const gemfileLockContents = Buffer.from(
    gemfileLockBase64,
    'base64',
  ).toString();
  const dependencies = gemfileLockToDependencies(gemfileLockContents);

  return {
    plugin: {
      name: 'bundled:rubygems',
      runtime: 'unknown',
    },
    scannedProjects: [
      {
        depTree: {
          name: specs.packageName,
          targetFile: specs.targetFile,
          dependencies,
        },
      },
    ],
  };
}

async function gatherSpecs(root, targetFile): Promise<Spec> {
  for (const inspector of inspectors) {
    if (inspector.canHandle(targetFile)) {
      return await inspector.gatherSpecs(root, targetFile);
    }
  }

  throw new Error(`Could not handle file: ${targetFile}`);
}
