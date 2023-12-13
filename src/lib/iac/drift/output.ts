import {
  DescribeOptions,
  DriftAnalysis,
  DriftResource,
  MissingByType,
  UnmanagedByType,
} from '../types';
import { findServiceMappingForType } from '../service-mappings';
import chalk from 'chalk';
import { leftPad } from 'snyk-cpp-plugin/dist/display/common';

export function getHumanReadableAnalysis(
  option: DescribeOptions,
  analysis: DriftAnalysis,
): string {
  let output = getHumanReadableHeader();
  output += getHumanReadableUnmanaged(analysis);

  if (analysis.missing && analysis.missing.length > 0) {
    output += getHumanReadableMissing(analysis);
  }

  output += getHumanReadableSummary(analysis);

  return output;
}

function getHumanReadableMissing(analysis: DriftAnalysis): string {
  let output = '';
  if (!analysis.missing || analysis.missing.length <= 0) {
    return '';
  }
  const missingByStates = new Map<string, MissingByType>();

  for (const missing of analysis.missing) {
    let statefile = 'Generated';
    if (missing.source) {
      statefile = missing.source.source;
    }

    if (!missingByStates.has(statefile)) {
      missingByStates.set(statefile, {
        missingByType: new Map<string, DriftResource[]>(),
        count: 0,
      });
    }
    const hrMissing = mustGet(missingByStates, statefile);
    const type = missing.type;
    if (!hrMissing.missingByType.has(type)) {
      hrMissing.missingByType.set(type, []);
    }
    hrMissing.missingByType.get(type)?.push(missing);
    hrMissing.count++;
  }

  output += addLine(
    chalk.bold('Missing resources: ' + analysis.missing.length),
  );
  output += '\n';
  for (const state of [...missingByStates.keys()].sort()) {
    const hrMissing = mustGet(missingByStates, state);
    output += addLine(
      chalk.blue(
        'State: ' +
          chalk.bold(state) +
          ' [ Missing Resources: ' +
          chalk.bold(hrMissing.count.toString()) +
          ' ]',
      ),
    );
    output += '\n';
    for (const type of [...hrMissing.missingByType.keys()].sort()) {
      output += addLine(leftPad('Resource Type: ' + type, 2));
      const driftResources = mustGet(hrMissing.missingByType, type);
      output += getHumanReadableResourceList(driftResources) + '\n';
    }
  }
  return output;
}

function getHumanReadableResourceList(driftResources: DriftResource[]): string {
  let output = '';
  for (const res of driftResources) {
    output += leftPad('ID: ' + chalk.bold(res.id), 4);
    if (
      res.human_readable_attributes &&
      res.human_readable_attributes.size > 0
    ) {
      for (const humanReadableAttribute of [
        ...res.human_readable_attributes.keys(),
      ].sort()) {
        output +=
          ' ' +
          humanReadableAttribute +
          ': ' +
          res.human_readable_attributes.get(humanReadableAttribute);
      }
    }
    output += '\n';
  }
  return output;
}

function getHumanReadableUnmanaged(analysis: DriftAnalysis): string {
  let output = '';
  if (!analysis.unmanaged || analysis.unmanaged.length <= 0) {
    return '';
  }
  const unmanagedByServices = new Map<string, UnmanagedByType>();

  for (const unmanaged of analysis.unmanaged) {
    const service = findServiceMappingForType(unmanaged.type);

    if (!unmanagedByServices.has(service)) {
      unmanagedByServices.set(service, {
        unmanagedByType: new Map<string, DriftResource[]>(),
        count: 0,
      });
    }
    const hrUnmanaged = mustGet(unmanagedByServices, service);
    const type = unmanaged.type;
    if (!hrUnmanaged.unmanagedByType.has(type)) {
      hrUnmanaged.unmanagedByType.set(type, []);
    }
    hrUnmanaged.unmanagedByType.get(type)?.push(unmanaged);
    hrUnmanaged.count++;
  }

  output += addLine(
    chalk.bold('Unmanaged resources: ' + analysis.unmanaged.length),
  );
  output += '\n';
  for (let service of [...unmanagedByServices.keys()].sort()) {
    const hrUnmanaged = mustGet(unmanagedByServices, service);

    if (service === '') {
      service = 'Unidentified';
    }
    output += addLine(
      chalk.blue(
        'Service: ' +
          chalk.bold(service) +
          ' [ Unmanaged Resources: ' +
          chalk.bold(hrUnmanaged.count.toString()) +
          ' ]',
      ),
    );
    output += '\n';

    for (const type of [...hrUnmanaged.unmanagedByType.keys()].sort()) {
      output += addLine(leftPad('Resource Type: ' + type, 2));
      const driftResources = mustGet(hrUnmanaged.unmanagedByType, type);
      output += getHumanReadableResourceList(driftResources) + '\n';
    }
  }
  return output;
}

function getHumanReadableHeader(): string {
  // TODO: driftctl to return number of states and supported resources?
  let output = addLine(
    chalk.bold('Snyk Scanning Infrastructure As Code Discrepancies...'),
  );
  output += '\n';
  output += addLine(
    leftPad(
      'Info:    Resources under IaC, but different to terraform states.',
      2,
    ),
  );
  output += addLine(
    leftPad('Resolve: Reapply IaC resources or update into terraform.', 2),
  );
  output += '\n';

  return output;
}

function getHumanReadableSummary(analysis: DriftAnalysis): string {
  let output = addLine(chalk.bold('Test Summary'));
  output += '\n';

  // TODO: driftctl to return number of states
  if (analysis.managed) {
    output += addLine(
      leftPad(
        'Managed Resources: ' + chalk.bold(analysis.managed.length.toString()),
        2,
      ),
    );
  }
  if (analysis.missing) {
    output += addLine(
      leftPad(
        'Missing Resources: ' + chalk.bold(analysis.missing.length.toString()),
        2,
      ),
    );
  }

  if (analysis.unmanaged) {
    output += addLine(
      leftPad(
        'Unmanaged Resources: ' +
          chalk.bold(analysis.unmanaged.length.toString()),
        2,
      ),
    );
  }
  output += '\n';

  output += addLine(
    leftPad(
      'IaC Coverage: ' + chalk.bold(analysis.coverage.toString() + '%'),
      2,
    ),
  );
  output += addLine(
    leftPad(
      'Info: To reach full coverage, remove resources or move it to Terraform.',
      2,
    ),
  );
  output += '\n';

  output += addLine(
    leftPad('Tip: Run --help to find out about commands and flags.', 2),
  );
  output += addLine(
    leftPad(
      'Scanned with ' +
        analysis.provider_name +
        ' provider version ' +
        analysis.provider_version +
        '. Use --tf-provider-version to update.',
      6,
    ),
  );
  return output;
}

function addLine(line: string): string {
  return line + '\n';
}

// Used when we are sure the key exists because we just set it but typescript linter does not see that...
function mustGet<T>(map: Map<string, T>, key: string): T {
  const value = map.get(key);
  if (!value) {
    throw new Error('Key does not exists');
  }
  return value;
}
