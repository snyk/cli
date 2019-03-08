import {inspectors, Spec} from './inspectors';

interface InspectResult {
  plugin: {
    name: string;
    runtime: string;
  };
  package: {
    name: string;
    targetFile: string;
    files: any
  };
}

export async function inspect(root: string, targetFile: string): Promise<InspectResult> {
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
