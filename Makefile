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
	@rm -rf dist tsconfig.tsbuildinfo *.tgz binary-releases pysrc