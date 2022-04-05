# @snyk/protect

[![npm](https://img.shields.io/npm/v/@snyk/protect)](https://www.npmjs.com/package/@snyk/protect)
[![Known Vulnerabilities](https://snyk.io/test/github/snyk/snyk/badge.svg)](https://snyk.io/test/github/snyk/snyk)

<p align="center">
  <a href="https://snyk.io/#gh-light-mode-only">
    <img src="https://snyk.io/style/asset/logo/snyk-print.svg" />
  </a>
  <a href="https://snyk.io/#gh-dark-mode-only">
    <img src="https://user-images.githubusercontent.com/1393946/161861176-d30157b8-afcf-4119-88de-bec5b16e48b6.svg" />
  </a>
</p>

Patch vulnerable code in your project's dependencies. This package is officially maintained by [Snyk](https://snyk.io).

## Usage

You don't typically need to add the @snyk/protect dependency manually. It'll be introduced when it's needed as part of [Snyk's Fix PR service](https://support.snyk.io/hc/en-us/articles/360011484018-Fixing-vulnerabilities).

To enable patches in your Fix PRs:

- Visit https://app.snyk.io
- Go to "Org Settings" > "Integrations"
- Choose "Edit Settings" under your SCM integration.
- Under the "Fix Pull Request" section, ensure patches are enabled.

Snyk will now include patches as part of its Fix PRs for your project.

## How it works

If there's a patch available for a vulnerability in your project, the Fix PR:

- Adds a `patch` entry to your `.snyk` file.
- Adds `@snyk/protect` to your `package.json`'s dependencies.
- Adds `@snyk/protect` to your `package.json`'s [`prepare` script](https://docs.npmjs.com/cli/v7/using-npm/scripts).

```patch
 {
   "name": "my-project",
   "scripts": {
+    "prepare": "npm run snyk-protect",
+    "snyk-protect": "snyk-protect"
   },
   "dependencies": {
+    "@snyk/protect": "^1.657.0"
   }
 }
```

Now after you run npm install, @snyk/protect will automatically download each patch configured in your .snyk file and apply them to your installed dependencies.

## Migrating from `snyk protect` to `@snyk/protect`

`@snyk/protect` is a standalone replacement for `snyk protect`. They both do the same job, however:

- `@snyk/protect` has zero dependencies.
- You don't need to include `snyk` in your dependencies (which is a much larger package with many dependencies).

If you already have Snyk Protect set up, you can migrate to `@snyk/protect` by applying the following changes to your `package.json`:

```patch
 {
   "name": "my-project",
   "scripts": {
     "prepare": "npm run snyk-protect",
-    "snyk-protect": "snyk protect"
+    "snyk-protect": "snyk-protect"
   },
   "dependencies": {
-    "snyk": "^1.500.0"
+    "@snyk/protect": "^1.657.0"
   }
 }
```

We have also created the [@snyk/cli-protect-upgrade](https://www.npmjs.com/package/@snyk/cli-protect-upgrade) npx script which you can use to update your project automatically. To use it, `cd` to the location containing the package.json to be updated and run:

```
npx @snyk/cli-protect-upgrade
```

---

Made with 💜 by Snyk
