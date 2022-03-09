GOPATH := $(CURDIR)
GOBIN := $(CURDIR)/bin
PROJECT_SRC := $(CURDIR)/src/hcltojson-v2
PROJECT_OUT := $(CURDIR)/src/hcltojson-v2/dist

.PHONY: build
build: $(PROJECT_OUT)/hcltojson-v2.js

.PHONY: test
test: $(PROJECT_OUT)/hcltojson-v2.js
	node $(PROJECT_SRC)/test.js

.PHONY: clean
clean:
	rm -rf $(PROJECT_OUT) bin pkg $(PROJECT_SRC)/vendor

print-%  : ; @echo $* = $($*)

.PHONY: release
release:
	chmod +x ./test-and-release.sh && ./test-and-release.sh $(version)

$(GOBIN)/gopherjs:
	go get github.com/gopherjs/gopherjs@v0.0.0-20220221023154-0b2280d3ff96

$(PROJECT_SRC)/vendor: $(PROJECT_SRC)/go.mod $(PROJECT_SRC)/go.sum
	cd $(PROJECT_SRC); go mod vendor

$(PROJECT_OUT)/hcltojson-v2.js $(PROJECT_OUT)/hcltojson-v2.js.map: $(GOBIN)/gopherjs $(PROJECT_SRC)/hcltojson-v2.go $(PROJECT_SRC)/vendor
	cd $(PROJECT_SRC); GOOS=linux $(GOBIN)/gopherjs build -m -o $(PROJECT_OUT)/hcltojson-v2.js hcltojson-v2.go

