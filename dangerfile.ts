import {
  danger,
  fail,
  markdown,
  message,
  peril,
  results,
  schedule,
  warn,
} from 'danger';

(async () => {
  /**
   * The 'danger' import above is a hack DangerJS uses for type-safety. When
   * this script is run, DangerJS adds those values to the global runtime and
   * removes the import statement. So we need to pass through those globals to
   * each rule. This lets us test them outside the Danger runtime and avoid weird
   * global namespace hacks.
   */
  const dangerJs = {
    danger,
    fail,
    markdown,
    message,
    peril,
    results,
    schedule,
    warn,
  };

  const modules = [
    () => import('@snyk/danger-rules/validateCommitMessages'),
    () => import('@snyk/danger-rules/requireGeneratingHelpFiles'),
    () => import('@snyk/danger-rules/recommendWritingTest'),
    () => import('@snyk/danger-rules/recommendJest'),
    () => import('@snyk/danger-rules/recommendRunningSmokeTests'),
    () => import('@snyk/danger-rules/recommendMigratingModuleSyntax'),
  ];

  for (const module of modules) {
    (await module()).rule(dangerJs);
  }
})();
