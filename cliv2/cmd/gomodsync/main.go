package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/snyk/cli/cliv2/internal/gomodsync"
	"golang.org/x/mod/modfile"
)

func main() {
	mode := flag.String("mode", "validate", "Mode: validate (check for drift) or sync (fix drift)")
	publicPath := flag.String("public", "cliv2/go.mod", "Path to the public go.mod")
	privatePath := flag.String("private", "cliv2-private/go.mod", "Path to the private go.mod")
	flag.Parse()

	if *mode != "validate" && *mode != "sync" {
		fmt.Fprintf(os.Stderr, "ERROR: unknown mode %q (use 'validate' or 'sync')\n", *mode)
		os.Exit(1)
	}

	pubData, err := os.ReadFile(*publicPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot read public go.mod: %v\n", err)
		os.Exit(1)
	}

	privData, err := os.ReadFile(*privatePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot read private go.mod: %v\n", err)
		os.Exit(1)
	}

	pubFile, err := modfile.Parse(*publicPath, pubData, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot parse public go.mod: %v\n", err)
		os.Exit(1)
	}

	privFile, err := modfile.Parse(*privatePath, privData, nil)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot parse private go.mod: %v\n", err)
		os.Exit(1)
	}

	versionDrift := gomodsync.FindVersionDrift(pubFile, privFile)
	replaceDrift := gomodsync.FindReplaceDrift(pubFile, privFile)

	if *mode == "validate" {
		exitCode := gomodsync.ReportDrift(os.Stdout, versionDrift, replaceDrift)
		os.Exit(exitCode)
	}

	gomodsync.ApplySync(os.Stderr, pubFile, versionDrift, replaceDrift)

	pubFile.Cleanup()
	out, err := pubFile.Format()
	if err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot format public go.mod: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(*publicPath, out, 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "ERROR: cannot write public go.mod: %v\n", err)
		os.Exit(1)
	}

	total := len(versionDrift) + len(replaceDrift)
	if total > 0 {
		fmt.Printf("Synced %d issue(s) from private to public go.mod\n", total)
	} else {
		fmt.Println("go.mod files are already in sync")
	}
}
