#!make
#
# This Makefile is only for building release artifacts. Use `npm run` for CLIv1 scripts.
#
# Documentation: https://www.gnu.org/software/make/manual/make.html
#

# First target is default when running `make`.
.PHONY: help
help:
	@echo 'Usage: make <target>'
	@echo
	@echo 'This Makefile is currently only for building release artifacts.'
	@echo 'Use `npm run` for CLIv1 scripts.'

binary-releases:
	mkdir binary-releases

binary-releases/version: | binary-releases
	./release-scripts/next-version.sh > binary-releases/version

# this target is destructive since package.json files are modified in-place.
prepack: binary-releases/version
	@echo "'make prepack' was run. Run 'make clean-prepack' to rollback your package.json changes and this file." > prepack
	npm version "$(shell cat binary-releases/version)" --no-git-tag-version --workspaces --include-workspace-root
	npx ts-node ./release-scripts/prune-dependencies-in-packagejson.ts

.PHONY: clean-prepack
clean-prepack:
	git checkout package.json package-lock.json packages/*/package.json packages/*/package-lock.json
	rm -f prepack

binary-releases/release.json: binary-releases/version $(wildcard binary-releases/*.sha256)
	./release-scripts/release.json.sh

# --commit-path is forwarded to `git log <path>`.
#   We're using this to remove CLIv2 changes in v1's changelogs.
#   :(exclude) syntax: https://git-scm.com/docs/gitglossary.html#Documentation/gitglossary.txt-exclude
# Release notes uses version from package.json so we need to prepack beforehand.
binary-releases/RELEASE_NOTES.md: prepack | binary-releases
	npx conventional-changelog-cli -p angular -l -r 1 --commit-path ':(exclude)cliv2' > binary-releases/RELEASE_NOTES.md
