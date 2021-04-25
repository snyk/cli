GOPATH := $(CURDIR)
GOBIN := $(CURDIR)/bin
PROJECT_SRC := $(CURDIR)/src/hcltojson
PROJECT_OUT := $(CURDIR)/src/hcltojson/dist

.PHONY: build
build: $(PROJECT_OUT)/hcltojson.js

.PHONY: test
test: $(PROJECT_OUT)/hcltojson.js
	node $(PROJECT_SRC)/test.js

.PHONY: clean
clean:
	rm -rf $(PROJECT_OUT) bin pkg $(PROJECT_SRC)/vendor

$(GOBIN)/gopherjs:
	go get github.com/gopherjs/gopherjs

$(PROJECT_SRC)/vendor: $(PROJECT_SRC)/go.mod $(PROJECT_SRC)/go.sum
	cd $(PROJECT_SRC); go mod vendor

$(PROJECT_OUT)/hcltojson.js $(PROJECT_OUT)/hcltojson.js.map: $(GOBIN)/gopherjs $(PROJECT_SRC)/hcltojson.go $(PROJECT_SRC)/vendor
	cd $(PROJECT_SRC); GOOS=linux $(GOBIN)/gopherjs build -m -o $(PROJECT_OUT)/hcltojson.js $(PROJECT_SRC)/hcltojson.go

