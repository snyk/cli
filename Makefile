#!make
# Documentation: https://www.gnu.org/software/make/manual/make.html

MIN_MAKE_VERSION := 4.2.1
ifneq ($(MIN_MAKE_VERSION),$(firstword $(sort $(MAKE_VERSION) $(MIN_MAKE_VERSION))))
$(error 'GNU Make $(MIN_MAKE_VERSION) or above required.')
endif

NPM := npm
NPX := npx
JEST := $(NPX) jest --runInBand
WEBPACK := NODE_OPTIONS="--max-old-space-size=8192" $(NPX) webpack
PRETTIER := $(NPX) prettier
ESLINT := $(NPX) eslint
LERNA := $(NPX) lerna
TAP := NODE_OPTIONS="-r ts-node/register" $(NPX) tap -Rspec --timeout=300
TSNODE := $(NPX) ts-node
PKG := $(NPX) pkg ./

CLI_BUNDLE_FILE := dist/cli/index.js
BINARY_DIR := binary-releases
TMP_DIR := tmp

# First target is default.
.PHONY: help
help:
	@echo 'Usage: make <target>'
	@echo
	@echo 'The available targets are listed below.'
	@echo 'The primary workflow commands are given first,'
	@echo 'followed by less common or more advanced commands.'
	@echo 'For general help using "make", run `man make`.'
	@echo
	@echo 'Main targets:'
	@grep -E '^\.PHONY: [a-zA-Z_-]+ ## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = "(: | ## )"}; {printf "  \033[36m%-25s\033[0m %s\n", $$2, $$3}'
	@echo
	@echo 'All other targets:'
	@grep -E '^\.PHONY: [a-zA-Z_-]+ ### .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = "(: | ### )"}; {printf "  \033[34m%-25s\033[0m %s\n", $$2, $$3}'

.PHONY: dependencies ## install dependencies
dependencies: node_modules

node_modules:
	$(NPM) ci

.PHONY: format ## format all files
format:
	$(PRETTIER) --write '**/*.{js,ts,json,yaml,yml,md}'

.PHONY: format-changes ### format changed files
format-changes:
	./scripts/format/prettier-changes.sh

.PHONY: lint ## check files for issues
lint: lint-eslint lint-prettier

.PHONY: lint-eslint ### check js/ts files for issues
lint-eslint: | dependencies
	$(ESLINT) --quiet --color --cache '**/*.{js,ts}'

.PHONY: lint-prettier ### check files for formatting issues
lint-prettier: | dependencies
	$(PRETTIER) --check '**/*.{js,ts,json,yaml,yml,md}'

.PHONY: lint-build-environment ### check build environment for issues
lint-build-environment: | dependencies
	$(TSNODE) ./scripts/check-dev-environment.ts

.PHONY: build ## build packages and cli for development
build: lint-build-environment build-dev

.PHONY: build-dev ### build packages and cli for development
build-dev: build-packages build-cli-dev

.PHONY: build-prod ### build packages and cli for production
build-prod: build-packages build-cli-prod

.PHONY: build-packages ### build packages
build-packages: clean-build-packages | dependencies
	$(LERNA) run build --ignore snyk

.PHONY: build-cli-dev ### build cli for development
build-cli-dev: clean-build-cli | dependencies
	$(WEBPACK) --config webpack.dev.ts

.PHONY: build-cli-prod ### build cli for production
build-cli-prod: clean-build-cli | dependencies
	$(WEBPACK) --config webpack.prod.ts

.PHONY: install ## install cli using npm
install: $(BINARY_DIR)/snyk-node.tgz
	$(NPM) install -g ./$<

.PHONY: watch ## automatically rebuild when cli sources are changed
watch: build-packages clean-build-cli
	$(WEBPACK) --config webpack.dev.ts --watch

.PHONY: test ## run all tests
test: test-unit test-acceptance test-tap

.PHONY: test-unit ### run unit tests
test-unit: clean-test | dependencies
	$(JEST) --testPathPattern '/test(/jest)?/unit/'

.PHONY: test-acceptance ### run acceptance tests
test-acceptance: clean-test | dependencies
	$(JEST) --testPathPattern '/test(/jest)?/acceptance/'

.PHONY: test-tap ### run deprecated cli tap tests
test-tap: clean-test | dependencies
	$(TAP) test/tap/*.test.*

.PHONY: test-smoke ### run cli smoke tests
test-smoke: clean-test | dependencies
	./scripts/run-smoke-tests-locally.sh

.PHONY: clean ## remove all generated files
clean: clean-dependencies clean-cache clean-test clean-build

.PHONY: clean-dependencies ### remove all dependencies
clean-dependencies:
	@rm -rf node_modules packages/*/node_modules

.PHONY: clean-cache ### remove all caches
clean-cache:
	@rm -rf .eslintcache

.PHONY: clean-test ### remove all test output
clean-test:
	@rm -rf test-results

.PHONY: clean-build ### remove all build files
clean-build: clean-build-packages clean-build-cli

.PHONY: clean-build-packages ### remove packages build files
clean-build-packages:
	@rm -rf packages/*/dist packages/*/tsconfig.tsbuildinfo packages/*/*.tgz

.PHONY: clean-build-cli ### remove cli build files
clean-build-cli:
	@rm -rf dist tsconfig.tsbuildinfo *.tgz pysrc $(BINARY_DIR) $(TMP_DIR)

$(CLI_BUNDLE_FILE):
	$(MAKE) build-prod

$(BINARY_DIR):
	mkdir $(BINARY_DIR)

$(TMP_DIR):
	mkdir $(TMP_DIR)

$(BINARY_DIR)/snyk-alpine: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	$(PKG) -t node16-alpine-x64 -o $@
	$(MAKE) $@.sha256

$(BINARY_DIR)/snyk-linux: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	$(PKG) -t node16-linux-x64 -o $@
	$(MAKE) $@.sha256

$(BINARY_DIR)/snyk-macos: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	$(PKG) -t node16-macos-x64 -o $@
	$(MAKE) $@.sha256

$(TMP_DIR)/snyk-win-unsigned.exe: $(CLI_BUNDLE_FILE) | $(TMP_DIR)
	$(PKG) -t node16-win-x64 -o $@

$(BINARY_DIR)/snyk-win.exe: $(TMP_DIR)/snyk-win-unsigned.exe cert.pem key.pem | $(BINARY_DIR)
	osslsigncode sign -h sha512 \
		-certs cert.pem \
		-key key.pem \
		-n "Snyk CLI" \
		-i "https://snyk.io" \
		-t "http://timestamp.comodoca.com/authenticode" \
		-in $< \
		-out $@
	$(MAKE) $@.sha256

$(BINARY_DIR)/snyk-for-docker-desktop-darwin-x64.tar.gz: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	./docker-desktop/build.sh darwin x64
	$(MAKE) $@.sha256

$(BINARY_DIR)/snyk-for-docker-desktop-darwin-arm64.tar.gz: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	./docker-desktop/build.sh darwin arm64
	$(MAKE) $@.sha256

$(BINARY_DIR)/docker-mac-signed-bundle.tar.gz: dist/cli/index.js | $(BINARY_DIR)
	./release-scripts/docker-desktop-release.sh
	$(MAKE) $@.sha256

$(BINARY_DIR)/snyk-node.tgz: $(CLI_BUNDLE_FILE) | $(BINARY_DIR)
	mv $(shell $(NPM) pack) $@

%.sha256: %
	cd $(@D); shasum -a 256 $(<F) > $(@F); shasum -a 256 -c $(@F)

cert.pem:
	@echo "$(SIGNING_CERT)" | base64 --decode > $@

key.pem:
	@echo "$(SIGNING_KEY)" | base64 --decode > $@
