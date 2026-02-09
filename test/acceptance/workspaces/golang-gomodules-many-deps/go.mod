module app

go 1.24.0

require (
	github.com/gorilla/mux v1.8.1
	github.com/hashicorp/go-retryablehttp v0.7.8
	golang.org/x/exp v0.0.0-20251113190631-e25ba8c21ef6
	k8s.io/utils v0.0.0-20251002143259-bc988d571ff4
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	golang.org/x/sys v0.32.0 // indirect
)

// version override
replace golang.org/x/exp => golang.org/x/exp v0.0.0-20260112195511-716be5621a96

// replace with fork
replace github.com/hashicorp/go-retryablehttp => github.com/wiz-sec/go-retryablehttp v0.7.8-wiz-1
