import * as theme from '../../../lib/theme';

export default function protectFunc() {
  console.log(
    theme.color.status.warn(
      `\n${theme.icon.WARNING} WARNING: Snyk protect was removed at 31 March 2022.\nPlease use '@snyk/protect' package instead: https://updates.snyk.io/snyk-wizard-and-snyk-protect-removal-224137 \n`,
    ),
  );
}
