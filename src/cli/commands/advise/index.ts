import { CommandResult } from '../types';
import * as path from 'path';
import { formatAdviseResult } from './formatAdviseResult';
import { readNpmDependencies } from './readNpmDependencies';
import { AdvisorClient } from '../../../lib/advisor/AdvisorClient';
import { processCommandArgs } from '../process-command-args';
import { MethodArgs } from '../../args';

const advisor = new AdvisorClient();

export default async function advise(...args0: MethodArgs): Promise<CommandResult> {
  const { packageJsonPath, maxScore } = parseArgs(...args0);

  const dependencies = await readNpmDependencies(path.resolve(packageJsonPath));

  const dependenciesWithScores = await advisor.scorePackages(dependencies);

  const filteredDependencies = dependenciesWithScores.filter(aDependency => aDependency.score <= maxScore)

  return formatAdviseResult({
    dependencies: filteredDependencies,
  })
}

type AdviseOptions = {
  packageJsonPath: string,
  maxScore: number,
}

const parseArgs = (...args0: MethodArgs): AdviseOptions => {

  const { options } = processCommandArgs(...args0);

  const maxScore = options.maxScore ? parseInt(options.maxScore) : 100;

  return {
    packageJsonPath: './package.json',
    maxScore,
  }
}
