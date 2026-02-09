package main

import (
	_ "net/url"

	_ "github.com/gorilla/mux"
	_ "github.com/hashicorp/go-retryablehttp"
	_ "golang.org/x/exp/slog/slogtest"
	_ "k8s.io/utils/diff"
)

func main() {
	// nothing to see here
}