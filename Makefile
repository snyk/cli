#!make
#
# This Makefile is only for building release artifacts. Use `npm run` for CLIv1 scripts.
#
# Documentation: https://www.gnu.org/software/make/manual/make.html
#

PKG := npx pkg ./ --compress Brotli
BINARY_WRAPPER_DIR = ts-binary-wrapper
EXTENSIBLE_CLI_DIR = cliv2
BINARY_RELEASES_FOLDER_TS_CLI = binary-releases
BINARY_OUTPUT_FOLDER = binary-releases

.DEFAULT: help
.PHONY: help
help:
	@echo 'Usage: make <target>'
	@echo
	@echo 'This Makefile is currently only for building release artifacts.'
	@echo 'Use `npm run` for CLIv1 scripts.'

$(BINARY_RELEASES_FOLDER_TS_CLI):
	@mkdir -p $(BINARY_RELEASES_FOLDER_TS_CLI)

$(BINARY_RELEASES_FOLDER_TS_CLI)/version: | $(BINARY_RELEASES_FOLDER_TS_CLI)
	./release-scripts/next-version.sh > $(BINARY_RELEASES_FOLDER_TS_CLI)/version

ifneq ($(BINARY_OUTPUT_FOLDER), $(BINARY_RELEASES_FOLDER_TS_CLI))
$(BINARY_OUTPUT_FOLDER):
	@mkdir -p $(BINARY_OUTPUT_FOLDER)

$(BINARY_OUTPUT_FOLDER)/version: $(BINARY_OUTPUT_FOLDER) $(BINARY_RELEASES_FOLDER_TS_CLI)/version
	@cp $(BINARY_RELEASES_FOLDER_TS_CLI)/version $(BINARY_OUTPUT_FOLDER)/version
endif

# prepack is not a typical target.
#   It modifies package.json files rather than only creating new files.
#   INTERMEDIATE prevents dependants from rebuilding when prepack is stale.
#     It will act as a passthrough and only rebuild dependants when version has changed.
#   SECONDARY disables INTERMEDIATE's auto-remove feature.
#     Only removing "prepack" is not enough. We need to do additional cleanup (see clean-prepack).
.INTERMEDIATE: prepack
.SECONDARY: prepack
prepack: $(BINARY_OUTPUT_FOLDER)/version
	@echo "'make prepack' was run. Run 'make clean-prepack' to rollback your package.json changes and this file." > prepack
	npm version "$(shell cat $(BINARY_RELEASES_FOLDER_TS_CLI)/version)" --no-git-tag-version --workspaces --include-workspace-root
	cd $(BINARY_WRAPPER_DIR) && npm version "$(shell cat $(CURDIR)/$(BINARY_RELEASES_FOLDER_TS_CLI)/version)" --no-git-tag-version --include-workspace-root
	npx ts-node ./release-scripts/prune-dependencies-in-packagejson.ts

.PHONY: clean-prepack
clean-prepack:
	git checkout package.json package-lock.json packages/*/package.json packages/*/package-lock.json $(BINARY_WRAPPER_DIR)/package.json $(BINARY_WRAPPER_DIR)/package-lock.json
	rm -f prepack

.PHONY: clean-ts
clean-ts: 
	npm run clean
	rm -f -r $(BINARY_RELEASES_FOLDER_TS_CLI)

$(BINARY_OUTPUT_FOLDER)/sha256sums.txt.asc:
	./release-scripts/sha256sums.txt.asc.sh

$(BINARY_OUTPUT_FOLDER)/release.json:
	./release-scripts/release.json.sh

# --commit-path is forwarded to `git log <path>`.
#   We're using this to remove CLIv2 changes in v1's changelogs.
#   :(exclude) syntax: https://git-scm.com/docs/gitglossary.html#Documentation/gitglossary.txt-exclude
# Release notes uses version from package.json so we need to prepack beforehand.
$(BINARY_OUTPUT_FOLDER)/RELEASE_NOTES.md: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	npx conventional-changelog-cli -p angular -l -r 1 > $(BINARY_OUTPUT_FOLDER)/RELEASE_NOTES.md

# Generates a shasum of a target with the same name.
# See "Automatic Variables" in GNU Make docs (linked at the top)
%.sha256: %
	cd $(@D); shasum -a 256 $(<F) > $(@F); shasum -a 256 -c $(@F)

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk.tgz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(MAKE) pack-binary-wrapper
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk.tgz.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-fix.tgz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	mv $(shell npm pack --workspace '@snyk/fix') $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-fix.tgz
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-fix.tgz.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-protect.tgz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	mv $(shell npm pack --workspace '@snyk/protect') $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-protect.tgz
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-protect.tgz.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-alpine: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(PKG) -t node16-alpine-x64 -o $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-alpine
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-alpine.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(PKG) -t node16-linux-x64 -o $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux.sha256

# Why `--no-bytecode` for Linux/arm64:
#   arm64 bytecode generation requires various build tools on an x64 build
#   environment. So disabling until we can support it. It's an optimisation.
#   https://github.com/vercel/pkg#targets
$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux-arm64: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(PKG) -t node16-linux-arm64 -o $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux-arm64 --no-bytecode
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-linux-arm64.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-macos: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(PKG) -t node16-macos-x64 -o $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-macos
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-macos.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-win.exe: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	$(PKG) -t node16-win-x64 -o $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-win.exe
	./cliv2/scripts/sign_windows.sh $(BINARY_RELEASES_FOLDER_TS_CLI) snyk-win.exe
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-win.exe.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-for-docker-desktop-darwin-x64.tar.gz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	./docker-desktop/build.sh darwin x64
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-for-docker-desktop-darwin-x64.tar.gz.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-for-docker-desktop-darwin-arm64.tar.gz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	./docker-desktop/build.sh darwin arm64
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/snyk-for-docker-desktop-darwin-arm64.tar.gz.sha256

$(BINARY_RELEASES_FOLDER_TS_CLI)/docker-mac-signed-bundle.tar.gz: prepack | $(BINARY_RELEASES_FOLDER_TS_CLI)
	./release-scripts/docker-desktop-release.sh
	$(MAKE) $(BINARY_RELEASES_FOLDER_TS_CLI)/docker-mac-signed-bundle.tar.gz.sha256

# targets responsible for the Wrapper CLI (TS around Golang)
$(BINARY_WRAPPER_DIR)/README.md:
	@cp ./README.md $(BINARY_WRAPPER_DIR)/README.md

$(BINARY_WRAPPER_DIR)/SECURITY.md:
	@cp ./SECURITY.md $(BINARY_WRAPPER_DIR)/SECURITY.md

$(BINARY_WRAPPER_DIR)/LICENSE:
	@cp ./LICENSE $(BINARY_WRAPPER_DIR)/LICENSE

$(BINARY_WRAPPER_DIR)/src/generated/binary-deployments.json: $(BINARY_WRAPPER_DIR)/src/generated
	@cp ./binary-deployments.json $(BINARY_WRAPPER_DIR)/src/generated/binary-deployments.json

$(BINARY_WRAPPER_DIR)/src/generated:
	@mkdir -p $(BINARY_WRAPPER_DIR)/src/generated/

$(BINARY_WRAPPER_DIR)/src/generated/version: $(BINARY_WRAPPER_DIR)/src/generated $(BINARY_RELEASES_FOLDER_TS_CLI)/version
	@cp $(BINARY_RELEASES_FOLDER_TS_CLI)/version $(BINARY_WRAPPER_DIR)/src/generated/version

$(BINARY_WRAPPER_DIR)/src/generated/sha256sums.txt:
	@echo "-- Generating $(@F)"
	@cat $(BINARY_OUTPUT_FOLDER)/*.sha256 > $(BINARY_WRAPPER_DIR)/src/generated/sha256sums.txt

.PHONY: build-binary-wrapper
build-binary-wrapper: pre-build-binary-wrapper $(BINARY_WRAPPER_DIR)/src/generated/version $(BINARY_WRAPPER_DIR)/src/generated/sha256sums.txt
	@echo "-- Building Typescript Binary Wrapper ($(BINARY_WRAPPER_DIR)/dist/)"
	@cd $(BINARY_WRAPPER_DIR) && npm run build
	
.PHONY: clean-binary-wrapper
clean-binary-wrapper:
	@rm -f $(BINARY_WRAPPER_DIR)/config.default.json
	@rm -f $(BINARY_WRAPPER_DIR)/src/generated/binary-deployments.json
	@rm -f $(BINARY_WRAPPER_DIR)/README.md
	@rm -f $(BINARY_WRAPPER_DIR)/SECURITY.md
	@rm -f $(BINARY_WRAPPER_DIR)/LICENSE
	@rm -rf $(BINARY_WRAPPER_DIR)/src/generated
	@rm -rf $(BINARY_WRAPPER_DIR)/help
	@rm -rf $(BINARY_WRAPPER_DIR)/pysrc
	@cd $(BINARY_WRAPPER_DIR) && npm run clean

.PHONY: pre-build-binary-wrapper
pre-build-binary-wrapper: $(BINARY_WRAPPER_DIR)/README.md $(BINARY_WRAPPER_DIR)/SECURITY.md $(BINARY_WRAPPER_DIR)/LICENSE $(BINARY_WRAPPER_DIR)/src/generated/binary-deployments.json

# for compatibility reasons, we pack the legacy and the ts-binary-wrapper next to each other
.PHONY: pack-binary-wrapper
pack-binary-wrapper: build-binary-wrapper
	@echo "-- Packaging tarball ($(BINARY_OUTPUT_FOLDER)/snyk.tgz)"
	release-scripts/create-npm-artifact.sh $(BINARY_OUTPUT_FOLDER) $(BINARY_WRAPPER_DIR)


.PHONY: test-binary-wrapper
test-binary-wrapper: build-binary-wrapper
	@echo "-- Testing binary wrapper"
	@cd $(BINARY_WRAPPER_DIR) && npm run test


# targets responsible for the complete CLI build
.PHONY: pre-build
pre-build: pre-build-binary-wrapper $(BINARY_RELEASES_FOLDER_TS_CLI)

.PHONY: build
build: pre-build
	@cd $(EXTENSIBLE_CLI_DIR) && $(MAKE) build-full install bindir=$(CURDIR)/$(BINARY_OUTPUT_FOLDER) USE_LEGACY_EXECUTABLE_NAME=1

.PHONY: clean
clean:
	@cd $(EXTENSIBLE_CLI_DIR) && $(MAKE) clean-full
	$(MAKE) clean-prepack

# targets responsible for the testing of CLI build
.PHONY: acceptance-test-with-proxy
acceptance-test-with-proxy: pre-build
	@echo "-- Running acceptance tests in a proxied environment"
	@docker build -t acceptance-test-with-proxy -f ./test/acceptance/environments/proxy/Dockerfile .
	@docker run --rm --cap-add=NET_ADMIN acceptance-test-with-proxy ./node_modules/.bin/jest ./ts-binary-wrapper/test/acceptance/basic.spec.ts
# TODO: Run all acceptance tests behind a proxy using npm run test:acceptance

# targets responsible for the CLI release
.PHONY: release-pre
release-pre:
	@echo "-- Validating repository"
	@./release-scripts/validate-repository.sh
	@echo "-- Validating artifacts"
	@./release-scripts/validate-checksums.sh
	@echo "-- Publishing to S3 /version"
	@./release-scripts/upload-artifacts.sh version

.PHONY: release-final
release-final:
	@echo "-- Publishing"
	@./release-scripts/upload-artifacts.sh latest github npm
