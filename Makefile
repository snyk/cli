#!make
#
# This Makefile is only for building release artifacts. Use `npm run` for CLIv1 scripts.
#
# Documentation: https://www.gnu.org/software/make/manual/make.html
#

PKG := npx pkg ./ --compress Brotli

.DEFAULT: help
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

# prepack is not a typical target.
#   It modifies package.json files rather than only creating new files.
#   INTERMEDIATE prevents dependants from rebuilding when prepack is stale.
#     It will act as a passthrough and only rebuild dependants when version has changed.
#   SECONDARY disables INTERMEDIATE's auto-remove feature.
#     Only removing "prepack" is not enough. We need to do additional cleanup (see clean-prepack).
.INTERMEDIATE: prepack
.SECONDARY: prepack
prepack: binary-releases/version
	@echo "'make prepack' was run. Run 'make clean-prepack' to rollback your package.json changes and this file." > prepack
	npm version "$(shell cat binary-releases/version)" --no-git-tag-version --workspaces --include-workspace-root
	npx ts-node ./release-scripts/prune-dependencies-in-packagejson.ts

.PHONY: clean-prepack
clean-prepack:
	git checkout package.json package-lock.json packages/*/package.json packages/*/package-lock.json
	rm -f prepack

binary-releases/sha256sums.txt.asc: $(wildcard binary-releases/*.sha256)
	./release-scripts/sha256sums.txt.asc.sh

binary-releases/release.json: binary-releases/version $(wildcard binary-releases/*.sha256)
	./release-scripts/release.json.sh

# --commit-path is forwarded to `git log <path>`.
#   We're using this to remove CLIv2 changes in v1's changelogs.
#   :(exclude) syntax: https://git-scm.com/docs/gitglossary.html#Documentation/gitglossary.txt-exclude
# Release notes uses version from package.json so we need to prepack beforehand.
binary-releases/RELEASE_NOTES.md: prepack | binary-releases
	npx conventional-changelog-cli -p angular -l -r 1 --commit-path ':(exclude)cliv2' > binary-releases/RELEASE_NOTES.md

# Generates a shasum of a target with the same name.
# See "Automatic Variables" in GNU Make docs (linked at the top)
%.sha256: %
	cd $(@D); shasum -a 256 $(<F) > $(@F); shasum -a 256 -c $(@F)

binary-releases/snyk.tgz: prepack | binary-releases
	mv $(shell npm pack) binary-releases/snyk.tgz
	$(MAKE) binary-releases/snyk.tgz.sha256

binary-releases/snyk-fix.tgz: prepack | binary-releases
	mv $(shell npm pack --workspace '@snyk/fix') binary-releases/snyk-fix.tgz
	$(MAKE) binary-releases/snyk-fix.tgz.sha256

binary-releases/snyk-protect.tgz: prepack | binary-releases
	mv $(shell npm pack --workspace '@snyk/protect') binary-releases/snyk-protect.tgz
	$(MAKE) binary-releases/snyk-protect.tgz.sha256

binary-releases/snyk-alpine: prepack | binary-releases
	$(PKG) -t node16-alpine-x64 -o binary-releases/snyk-alpine
	$(MAKE) binary-releases/snyk-alpine.sha256

binary-releases/snyk-linux: prepack | binary-releases
	$(PKG) -t node16-linux-x64 -o binary-releases/snyk-linux
	$(MAKE) binary-releases/snyk-linux.sha256

# Why `--no-bytecode` for Linux/arm64:
#   arm64 bytecode generation requires various build tools on an x64 build
#   environment. So disabling until we can support it. It's an optimisation.
#   https://github.com/vercel/pkg#targets
binary-releases/snyk-linux-arm64: prepack | binary-releases
	$(PKG) -t node16-linux-arm64 -o binary-releases/snyk-linux-arm64 --no-bytecode
	$(MAKE) binary-releases/snyk-linux-arm64.sha256

binary-releases/snyk-macos: prepack | binary-releases
	$(PKG) -t node16-macos-x64 -o binary-releases/snyk-macos
	$(MAKE) binary-releases/snyk-macos.sha256

binary-releases/snyk-win.exe: prepack | binary-releases
	$(PKG) -t node16-win-x64 -o binary-releases/snyk-win-unsigned.exe
	./release-scripts/sign-windows-binary.sh
	rm binary-releases/snyk-win-unsigned.exe
	$(MAKE) binary-releases/snyk-win.exe.sha256

binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz: prepack | binary-releases
	./docker-desktop/build.sh darwin x64
	$(MAKE) binary-releases/snyk-for-docker-desktop-darwin-x64.tar.gz.sha256

binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz: prepack | binary-releases
	./docker-desktop/build.sh darwin arm64
	$(MAKE) binary-releases/snyk-for-docker-desktop-darwin-arm64.tar.gz.sha256

binary-releases/docker-mac-signed-bundle.tar.gz: prepack | binary-releases
	./release-scripts/docker-desktop-release.sh
	$(MAKE) binary-releases/docker-mac-signed-bundle.tar.gz.sha256
