package main

/**
 * This script is used to upgrade the go dependencies in the cliv2 project.
 *
 * It uses the GitHub API to fetch the latest commit SHA for the specified repository
 * and then uses the `go get` command to upgrade the dependency.
 *
 * Usage:
 * go run scripts/upgrade-snyk-go-dependencies.go --name=go-application-framework
 */
import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os/exec"
)

type Commit struct {
	SHA string `json:"sha"`
}

func getLatestCommitSHA(name string) (string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/snyk/%s/commits", name)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	client := http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func(Body io.ReadCloser) {
		err := Body.Close()
		if err != nil {

		}
	}(resp.Body)

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Failed to fetch commits. Status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var commits []Commit
	if err := json.Unmarshal(body, &commits); err != nil {
		return "", err
	}

	if len(commits) == 0 {
		return "", fmt.Errorf("No commits found for repository %s", name)
	}

	return commits[0].SHA, nil
}

func upgradeGoMod(name, commitSHA string) error {
	cmd := exec.Command("go", "get", "-u", fmt.Sprintf("github.com/snyk/%s@%s", name, commitSHA))
	cmd.Dir = "./cliv2"
	if err := cmd.Run(); err != nil {
		return err
	}

	cmd = exec.Command("go", "mod", "tidy")
	cmd.Dir = "./cliv2"
	if err := cmd.Run(); err != nil {
		return err
	}

	return nil
}

func upgradeDep(name string) error {
	commitSHA, err := getLatestCommitSHA(name)
	if err != nil {
		return err
	}
	fmt.Printf("The most recent commit SHA for %s is: %s\n", name, commitSHA)

	if err := upgradeGoMod(name, commitSHA); err != nil {
		return err
	}

	return nil
}

func main() {
	name := flag.String("name", "", "Repository name to download from (e.g., go-application-framework)")
	flag.Parse()

	if *name == "" {
		if err := upgradeDep("go-application-framework"); err != nil {
			fmt.Printf("An error occurred: %v\n", err)
		}
		if err := upgradeDep("snyk-ls"); err != nil {
			fmt.Printf("An error occurred: %v\n", err)
		}
	} else {
		if err := upgradeDep(*name); err != nil {
			fmt.Printf("An error occurred: %v\n", err)
		}
	}
}
