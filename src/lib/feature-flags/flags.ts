import {
  SHOW_MAVEN_BUILD_SCOPE,
  SHOW_NPM_SCOPE,
  CLI_DOTNET_RUNTIME_RESOLUTION,
} from './index';
import {
  UV_FEATURE_FLAG,
  MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
  INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
  DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
} from '../package-managers';
import {
  SCAN_USR_LIB_JARS_FEATURE_FLAG,
  CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
  DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
  CONTAINER_NEW_FACTS_FEATURE_FLAG,
} from '../../cli/commands/constants';

/**
 * Every feature flag the TypeScript (legacy) CLI checks — the single source of
 * truth for the TS-side flag set. The Go layer preloads these so one batch
 * resolves them all (cliv2/internal/proxy/interceptor/legacy_cli_feature_flags.go),
 * and flag-registry-sync.spec.ts fails CI if the two lists drift apart or if a
 * flag is checked in src/ that isn't listed here.
 *
 * Flags referenced elsewhere only as string literals are listed inline.
 */
export const ALL_TS_FEATURE_FLAGS: readonly string[] = [
  SHOW_MAVEN_BUILD_SCOPE,
  SHOW_NPM_SCOPE,
  CLI_DOTNET_RUNTIME_RESOLUTION,
  UV_FEATURE_FLAG,
  MAVEN_DVERBOSE_EXHAUSTIVE_DEPS_FF,
  INCLUDE_GO_STANDARD_LIBRARY_DEPS_FEATURE_FLAG,
  DISABLE_GO_PACKAGE_URLS_IN_CLI_FEATURE_FLAG,
  SCAN_USR_LIB_JARS_FEATURE_FLAG,
  CONTAINER_CLI_APP_VULNS_ENABLED_FEATURE_FLAG,
  DISABLE_CONTAINER_MONITOR_PROJECT_NAME_FIX_FEATURE_FLAG,
  CONTAINER_NEW_FACTS_FEATURE_FLAG,
  'iacNewEngine',
  'iacIntegratedExperience',
  'iacShareCliResultsCustomRules',
  'iacCliShareResults',
  'cliSnykFix',
];
