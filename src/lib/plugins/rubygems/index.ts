import {inspectors, Spec} from './inspectors';
import * as types from '../types';
import {MissingTargetFileError} from '../../errors/missing-targetfile-error';

interface RubyGemsInspectResult extends types.InspectResult {
  package: {
    name: string;
    targetFile: string;
    files: any
  };
}

export async function inspect(root: string, targetFile: string): Promise<RubyGemsInspectResult> {
  if (!targetFile ) {
    throw MissingTargetFileError(root);
  }
  const specs = await gatherSpecs(root, targetFile);

  return {
    plugin: {
      name: 'bundled:rubygems',
      runtime: 'unknown',
    },
    package: {
      name: specs.packageName,
      targetFile: specs.targetFile,
      files: specs.files,
    },
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
