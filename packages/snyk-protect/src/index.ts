import protectLib from './lib';

export async function protect() {
  const projectPath = process.cwd();
  await protectLib(projectPath);
}
