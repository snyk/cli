import { CommandResult } from '../types';
import * as path from 'path';
import { FakeAdvisorClient } from './client/FakeAdvisorClient';
import { formatAdviseResult } from './formatAdviseResult';
import { readDependencies } from './readDependencies';

const advisor = new FakeAdvisorClient();

export default async function advise(): Promise<CommandResult> {

  const dependencies = await readDependencies(path.resolve('./package.json'));

  const dependenciesWithScores = await advisor.scorePackages(dependencies);

  return formatAdviseResult({
    dependencies: dependenciesWithScores,
  })
}
