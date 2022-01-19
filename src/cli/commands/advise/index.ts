import { CommandResult } from '../types';
import * as path from 'path';
import { formatAdviseResult } from './formatAdviseResult';
import { readNpmDependencies } from './readNpmDependencies';
import { AdvisorClient } from '../../../lib/advisor/AdvisorClient';

const advisor = new AdvisorClient();

export default async function advise(): Promise<CommandResult> {

  const dependencies = await readNpmDependencies(path.resolve('./package.json'));

  const dependenciesWithScores = await advisor.scorePackages(dependencies);

  return formatAdviseResult({
    dependencies: dependenciesWithScores,
  })
}
