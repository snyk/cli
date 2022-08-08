package main

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/snyk/cli-extension-lib-go/extension"
)

type BundledExtensionInfo struct {
	Repo       string `json:"repo"`
	CommitHash string `json:"commit_hash"`
}

type BundledExtensions struct {
	Extensions []*BundledExtensionInfo
}

func deserBundledExtensions() (*BundledExtensions, error) {
	bundledExtensionsFilePath := "./bundled_extensions.json"
	_, err := os.Stat(bundledExtensionsFilePath)
	if err != nil {
		return nil, fmt.Errorf("bundled_extensions.json file does not exist: %s", bundledExtensionsFilePath)
	}

	bytes, err := os.ReadFile(bundledExtensionsFilePath)
	if err != nil {
		return nil, err
	}

	var be BundledExtensions
	err = json.Unmarshal(bytes, &be)
	if err != nil {
		return nil, err
	}

	return &be, nil
}

func runCommand(workingDirectory string, command string, args []string) error {
	fmt.Printf("runCommand in dir %s\n  - %s %s\n", workingDirectory, command, args)

	// return error if dir does not exist
	_, err := os.Stat(workingDirectory)
	if err != nil {
		return err
	}

	cmd := exec.Command(command, args...)
	cmd.Dir = workingDirectory

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	cmd.Start()
	err = cmd.Wait()

	return err
}

func makeAllDir(dirPath string) error {
	err := os.MkdirAll(dirPath, 0755)
	return err
}

func main() {
	baseExtensionBuildDir := "./_build_extensions"
	makeAllDir(baseExtensionBuildDir)

	bundledExtensions, err := deserBundledExtensions()
	if err != nil {
		panic(err)
	}

	// make base extension build output directory if it doesn't exist
	for _, e := range bundledExtensions.Extensions {
		fmt.Println("repo:", e.Repo)
		fmt.Println("commit_hash:", e.CommitHash)
		fmt.Println("")

		err = runCommand(baseExtensionBuildDir, "pwd", nil)
		if err != nil {
			panic(err)
		}

		url, err := url.Parse(e.Repo)
		if err != nil {
			panic(err)
		}

		fmt.Println("Path:", url.Path)
		orgName := strings.Split(url.Path, "/")[1]
		if orgName != "snyk" {
			panic("org name must be `snyk`")
		}
		repoName := strings.Split(url.Path, "/")[2]
		fmt.Println("repoName:", repoName)

		runCommand(baseExtensionBuildDir, "git", []string{"clone", e.Repo})
		if err != nil {
			panic(err)
		}

		repoDir := path.Join(baseExtensionBuildDir, repoName)
		err = runCommand(repoDir, "git", []string{"checkout", e.CommitHash})
		if err != nil {
			panic(err)
		}

		err = runCommand(repoDir, "make", []string{"build"})
		if err != nil {
			panic(err)
		}

		x, err := extension.TryLoad(repoDir)
		if err != nil {
			fmt.Println("failed to load extension metadata")
			panic(err)
		}
		extensionName := x.Metadata.Name

		targetDir := path.Join("../../internal/embedded/_data/extensions", extensionName)
		fmt.Println("targetDir:", targetDir)

		err = runCommand(repoDir, "make", []string{"install", "prefix=" + targetDir})
		if err != nil {
			panic(err)
		}
	}
}
