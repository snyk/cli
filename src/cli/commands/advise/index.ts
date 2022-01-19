import { CommandResult } from '../types';
import * as path from 'path';
import { formatAdviseResult } from './formatAdviseResult';
import { readNpmDependencies } from './readNpmDependencies';
import { AdvisorClient } from '../../../lib/advisor/AdvisorClient';
import { processCommandArgs } from '../process-command-args';
import { MethodArgs } from '../../args';
import { Maintenance, maintenanceFromString, ScoredPackage } from '../../../lib/advisor/types';
import { shouldDisplay } from '../../../lib/advisor/shouldDisplay';

const advisor = new AdvisorClient();

export default async function advise(...args0: MethodArgs): Promise<CommandResult> {
  const { packageJsonPath, acceptableScore, acceptableMaintenance, ci } = parseArgs(...args0);

  const dependencies = await readNpmDependencies(path.resolve(packageJsonPath));

  const dependenciesWithScores = await advisor.scorePackages(dependencies);

  const dependenciesToShow = dependenciesWithScores.filter(aDependency => shouldDisplay(aDependency, acceptableScore, acceptableMaintenance))

  const result = formatAdviseResult({
    dependencies: dependenciesToShow,
  });

  if(dependenciesToShow.length > 0 && ci) {
    throw new Error(result.result)
  }

  return result;
}

type AdviseOptions = {
  ci: boolean,
  packageJsonPath: string,
  acceptableScore: number | null,
  acceptableMaintenance: Maintenance | null,
}

const parseArgs = (...args0: MethodArgs): AdviseOptions => {

  const { options } = processCommandArgs(...args0);

  const acceptableScore = options.acceptableScore ? parseInt(options.acceptableScore) : null;
  const acceptableMaintenance = options.acceptableMaintenance ? maintenanceFromString(options.acceptableMaintenance) : null;

  return {
    packageJsonPath: './package.json',
    acceptableScore,
    acceptableMaintenance,
    ci: !!options.ci,
  }
}
