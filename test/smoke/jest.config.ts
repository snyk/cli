import { createJestConfig } from '../createJestConfig';

export default createJestConfig({
    displayName: 'smoke',
    ignoreDirectories: ['node_modules', 'dist', 'build', '.vscode', '.idea', '.git', '.nyc_output', '.turbo', '.cache'],
 });
