# Snyk's (try) require

This package tries to load and parse a `package.json` file. This does *not* load the package into memory (as per `require`).

What snyk-try-require does:

- Returns a promise
- Does *not* throw if the `package.json` can't be found, but fulfills with `null`
- Uses `debug` module under the `snyk:resolve:try-require` key
- Uses lru-cache for caching for 100 objects for 1 hour
- Adds `dependencies` and `devDependencies` if they're missing
- Adds `__filename` containing the full original path to the package
- If a Snyk policy is present, will add the path of the policy to the `snyk` property
- If the package uses `npm-shrinkwrap.json` will include a `shrinkwrap` boolean property