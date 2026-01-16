# Adding `uv` package manager support

## Status Key

- ✅ **Completed** - Already implemented and working
- ⚠️ **In Progress** - Partially done, workaround in place, or needs completion
- ❌ **Not Started** - Not yet implemented
- 🚫 **Do NOT Add** - Explicitly should NOT be added (not supported/not applicable)

## Overview

Currently, the CLI uses `pip` as a workaround for `uv` projects. To add proper `uv` package manager support, we need to update multiple repositories.

**⚠️ Implementation order:** Registry must be updated FIRST - the monitor endpoint validates package managers via `isSupported()` which checks the `ossPackageManagers` array. Without this, all API calls will fail with 404.

## Reference commits

**Registry commits for adding package managers:**
- **`d04ce289e80a`** - "feat: enable scm support of pipenv projects" (July 2023) - **MERGED** - Most relevant reference for adding a Python package manager (includes core registration + SCM)
- **`58d3c74143`** - "feat: add pipenv support" (June 2023) - Unmerged, but shows similar pattern
- **`c86f21d9c1`** - "feat: add support for swift package manager" (Dec 2022) - Simpler example, just adds to arrays and PACKAGE_MANAGERS
- **`d6b937ab64`** - "feat: [OSM-1040] pnpm cli test and monitor support" (April 2024) - Shows CLI-specific overrides in PACKAGE_MANAGERS_CLI
- **`8403240fe81`** - "feat: add secrets project type" (Oct 2025) - Shows adding helper function pattern

**Most relevant:** `d04ce289e80a` (pipenv SCM support) - **This commit was actually merged** and shows the core package manager registration pattern we need. Python package manager with same `vulnDbType: 'pip'` configuration as `uv` needs.

**Note:** We'd make a subset of changes from that commit - same core package manager registration pattern (ossPackageManagers, PACKAGE_MANAGERS entry, isPipenv() helper, correlation.ts, presenters.ts), but skip all SCM-related infrastructure (deps-discovery handlers, deps-service, import-apps sub-tasks) since `uv` support is CLI-only for `snyk monitor`.

## Repositories that need updates

### 1. **CLI** (`/Users/thomasschafer/Development/Snyk/cli`)

#### File: `src/lib/package-managers.ts`

**Status:** ⚠️ **In Progress** (feature flag constant needed)

1. ✅ Add `'uv'` to `SupportedPackageManagers` type
2. ✅ Add `UV_LOCK = 'uv.lock'` to `SUPPORTED_MANIFEST_FILES` enum
3. ✅ Add `uv: 'uv'` to `SUPPORTED_PACKAGE_MANAGER_NAME` mapping
4. ✅ Add `'uv'` to `GRAPH_SUPPORTED_PACKAGE_MANAGERS` array
5. ⚠️ Add `UV_FEATURE_FLAG` constant:
   ```typescript
   export const UV_FEATURE_FLAG = 'enableUvCLI';
   ```
6. 🚫 **Do NOT add** `'uv'` to `PINNING_SUPPORTED_PACKAGE_MANAGERS` - `uv` does not support pinning

#### File: `src/lib/detect.ts`

**Status:** ⚠️ **In Progress** (feature flag check needed)

1. ✅ `'uv.lock'` is in `DETECTABLE_FILES` and `AUTO_DETECTABLE_FILES` arrays
2. ✅ `[SUPPORTED_MANIFEST_FILES.UV_LOCK]: 'uv'` is in `DETECTABLE_PACKAGE_MANAGERS` mapping
3. ⚠️ **MUST FIX:** Update `isFileCompatible()` to check feature flag:
   ```typescript
   if (file === SUPPORTED_MANIFEST_FILES.UV_LOCK &&
       !featureFlags.has(UV_FEATURE_FLAG)) {
     return false;
   }
   ```

#### File: `src/lib/plugins/index.ts`

**Status:** ✅ **COMPLETED**

1. ✅ `import * as uvPlugin from './uv'` is present
2. ✅ `case 'uv': return uvPlugin;` is in `loadPlugin` function

#### File: `src/lib/plugins/uv/index.ts`

**Status:** ⚠️ **In Progress** (waiting for backend support)

Update `packageManager` from `'pip'` to `'uv'`:
```typescript
packageManager: 'uv',  // Change from 'pip' to 'uv'
```

### 2. **Registry** (`/Users/thomasschafer/Development/Snyk/registry`)

#### File: `src/lib/domain/needs-refactoring/package-managers.ts`

**Status:** ❌ **Not Started**

**Changes needed:**

1. Add `'uv'` to `ossPackageManagers` array (around line 44, after `'pnpm'`)

2. Add `uv` entry to `PACKAGE_MANAGERS` object (after `pipenv`, around line 215):
   ```typescript
   uv: {
     manifestFiles: ['uv.lock', 'pyproject.toml'],
     defaultManifestFile: 'uv.lock',
     hasVulns: false,
     isSCMSupported: true,
     vulnDbType: 'pip',
     pkgFormatType: 'pip',
     isDepGraphApi: true,
     isGraphMonitor: true,
     isReachableVulnsSupported: true,
     sastLanguages: ['python'],
     featureFlag: 'enableUvCLI',
   },
   ```

3. **No entry needed in `PACKAGE_MANAGERS_CLI`** - `uv` will be automatically included via the `...PACKAGE_MANAGERS` spread operator (unlike `pnpm` which has CLI-specific overrides).

4. Add `isUv()` helper function (after `isPipenv()`, around line 781):
   ```typescript
   export function isUv(pkgManager: SupportedPackageManagers): boolean {
     return pkgManager === 'uv';
   }
   ```

5. 🚫 **Do NOT update** `isPinningSupported()` - `uv` does not support pinning

#### File: `src/lib/domain/risk-management/vuln/index.ts`

**Status:** 🚫 **Not Required**

Unlike `pip`, `uv` does not use pinning for remediation and should NOT set `noRemediation = true`.

#### File: `src/lib/domain/needs-refactoring/languages.ts`

**Status:** ❌ **Not Started**

**Changes needed:**

Add `'uv'` to Python language configuration (around line 58):
```typescript
python: {
  label: 'Python',
  name: 'python',
  packageManagers: ['pip', 'poetry', 'pipenv', 'uv'],  // Add 'uv'
  projectTypes: ['pip', 'poetry', 'pipenv', 'uv'],     // Add 'uv'
},
```

**Note:** This is used for UI language categorization and display.

#### File: `src/lib/domain/scm-platform/agents/correlation.ts`

**Status:** ❌ **Not Started**

**Changes needed:**

Add `case 'uv':` to `getProductLineForProjectType()` function (around line 44, after `pipenv`):
```typescript
case 'pip':
case 'pipenv':
case 'poetry':
case 'uv':  // Add this
  return ProductLine.OPEN_SOURCE;
```

**Note:** Used for analytics/correlation, even though CLI monitor doesn't directly call it, it's needed for consistency.

#### File: `src/web/presenters/package-managers.ts`

**Status:** ❌ **Not Started**

**Changes needed:**

Add `case 'uv':` to `linkToPackage()` function (around line 55, after `pipenv`):
```typescript
case 'poetry':
case 'pipenv':
case 'uv':  // Add this
case 'pip': {
  return `https://pypi.python.org/pypi/${packageName}`;
}
```

**Note:** Used for generating package links in PR templates and UI. Can share the same PyPI link as `pip`/`poetry`/`pipenv`.

### 3. **app-ui** (`/Users/thomasschafer/Development/Snyk/app-ui`)

#### File: `src/lib/utils/package-managers.ts`

**Changes needed:**

Add `uv` entry to `iconMap` object (around line 94, after `pipenv`):
```typescript
pipenv: defineAsyncComponent(() => import('@patchui/icons/custom/Pip.vue')),
uv: defineAsyncComponent(() => import('@patchui/icons/custom/uv.vue')),
```

**Note:** If `uv.vue` doesn't exist in `@patchui/icons` package, create it or temporarily use `Pip.vue` until the proper icon is created.

#### File: `src/lib/domain/internal-developer-tooling/features/index.ts`

**Status:** ✅ **Already exists**

The `enableUvCLI` feature flag already exists (line 1526):
```typescript
enableUvCLI: (req) => checkFlag(req, 'enableUvCLI', ['org', 'group'], false),
```

No changes needed.

### 3. **app-ui** (`/Users/thomasschafer/Development/Snyk/app-ui`)

#### File: `src/lib/utils/package-managers.ts`

**Status:** ❌ **Not Started**

**Changes needed:**

Add `uv` entry to `iconMap` object (around line 94, after `pipenv`):
```typescript
pipenv: defineAsyncComponent(() => import('@patchui/icons/custom/Pip.vue')),
uv: defineAsyncComponent(() => import('@patchui/icons/custom/uv.vue')),
```

**Note:** If `uv.vue` doesn't exist in `@patchui/icons` package, create it or temporarily use `Pip.vue` until the proper icon is created.

### 4. **Other repositories** (may need verification)

- **sca-engine**: May need to recognize `uv` as a valid package manager type
- **vuln-service**: Since `uv` uses `vulnDbType: 'pip'`, it should work automatically, but verify

## Implementation order

1. **Registry first** ⚠️ **CRITICAL**
   - Add `uv` to `ossPackageManagers` array
   - Add `uv` entry to `PACKAGE_MANAGERS` object
   - Add `isUv()` helper function
   - Add `'uv'` to `languages.ts` Python configuration
   - Add `case 'uv':` to `correlation.ts` `getProductLineForProjectType()`
   - Add `case 'uv':` to `presenters.ts` `linkToPackage()`
   - ✅ Feature flag `enableUvCLI` already exists

2. **CLI second**
   - Add `UV_FEATURE_FLAG` constant
   - Update `isFileCompatible()` to check feature flag
   - Update `uv` plugin to use `'uv'` instead of `'pip'`

3. **app-ui**
   - Add `uv` entry to `iconMap` in `package-managers.ts`
   - Ensure `uv.vue` icon exists in `@patchui/icons` package

4. **Test**
   - Verify `snyk monitor` and `snyk test` work with `uv` projects
   - Verify API endpoints accept `uv` as package manager
   - Verify project creation and monitoring in the UI
   - Verify `uv` icon displays correctly
   - Verify dep-graph pruning works (test with `--prune-repeated-subdependencies` flag)

## Current POC state

### ✅ Already implemented

- CLI detection (`uv.lock` file detection, package manager mapping)
- CLI type definitions (`SupportedPackageManagers`, `GRAPH_SUPPORTED_PACKAGE_MANAGERS`)
- Plugin infrastructure (`uv` plugin created, calls depgraph extension successfully)
- Monitor command works (using `pip` workaround)

### ❌ Not Started

- Backend support (Registry): `uv` not registered in `package-managers.ts`
- Feature flag check: `isFileCompatible()` doesn't check feature flag yet
- Plugin update: Still using `'pip'` instead of `'uv'`
- UI icon: `uv` not added to `iconMap` in app-ui

## Alternative: Expedited delivery (keep using `pip` as package manager type)

If we want to ship faster without adding `uv` as a new package manager type, we can continue using `pip` as the package manager identifier (like the current POC workaround). This avoids backend changes but means projects will appear as `pip` in the UI.

### What would be different

#### ✅ Still needed (same as full implementation)

1. **CLI detection** - Keep `uv.lock` detection working
2. **Feature flag** - Still add `UV_FEATURE_FLAG` and check in `isFileCompatible()` for gradual rollout
3. **Plugin** - Keep plugin working (already uses `'pip'` as package manager)

#### 🚫 Not needed (can skip)

1. **Registry changes** - No need to add `uv` to `ossPackageManagers` or `PACKAGE_MANAGERS`
2. **app-ui icon** - No need to add `uv` icon (projects will show as `pip`)
3. **Plugin update** - Keep using `packageManager: 'pip'` (no change needed)
4. **Helper functions** - No need for `isUv()` function in Registry

### Trade-offs

**Pros:**
- ✅ Faster delivery - no backend changes required
- ✅ No Registry deployment needed
- ✅ No UI changes needed
- ✅ Works immediately with existing infrastructure

**Cons:**
- ❌ Projects appear as `pip` in UI (not ideal for analytics/reporting)
- ❌ Can't distinguish `uv` projects from `pip` projects in the UI
- ❌ Future features that depend on accurate package manager type won't work correctly
- ❌ May need to migrate later anyway

### Implementation for expedited approach

1. **CLI only**
   - ✅ Keep `uv.lock` detection (already done)
   - ⚠️ Add `UV_FEATURE_FLAG` constant
   - ⚠️ Update `isFileCompatible()` to check feature flag
   - ✅ Keep plugin using `packageManager: 'pip'` (no change)

2. **No Registry changes** - Skip entirely

3. **No app-ui changes** - Skip entirely

4. **Test**
   - Verify `snyk monitor` and `snyk test` work with `uv` projects
   - Verify projects appear in UI (as `pip` type)
   - Verify feature flag controls rollout

### Migration path (if using expedited approach)

**Requirement:** Migration must happen automatically in the background when backend starts supporting `uv` - no user action required.

**Database migration:**

**Table:** `projects` (schema: `registry/src/schemas/generated/db/schema.sql`)

**Migration SQL:**
```sql
UPDATE projects
SET type = 'uv'
WHERE type = 'pip' 
  AND target_file = 'uv.lock'
  AND deleted IS NULL;
```

**Uniqueness constraints:**
Projects have EXCLUDE constraints that include `type`:
- `projects_uniqueness_idx_target_runtime_is_not_null`: `(org_public_id, name, type, origin, target_runtime, target_ref, org_target_public_id, target_file)`
- `projects_uniqueness_idx_target_runtime_is_null`: `(org_public_id, name, type, origin, target_ref, org_target_public_id, target_file)`

**Verification:**
- Check for conflicts: Query for existing `type = 'uv'` projects with same `(org_public_id, name, origin, target_file, target_ref, org_target_public_id)` as projects being migrated
- Test on staging/dev first
- Verify no uniqueness constraint violations

**Implementation:**
- Run automatically during Registry deployment when `uv` support is added
- Make script idempotent and reversible
