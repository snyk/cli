package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
)

func sbomFunc(cmd *cobra.Command, args []string) error {
	targetPath := ".."
	snykCmd := "node"
	snykCmdArguments := []string{"../dist/cli/index.js", "test", "--print-graph", "--json", "--all-projects", targetPath}

	jsonSeparatorEnd := []byte("DepGraph end")
	jsonSeparatorData := []byte("DepGraph data:")
	jsonSeparatorTarget := []byte("DepGraph target:")

	type sbomInvocation struct {
		targetName   string
		depGraphJson []byte
		sbomResponse []byte
	}

	var requestList []sbomInvocation

	snykCommand := exec.Command(snykCmd, snykCmdArguments...)
	snykOutput, err := snykCommand.Output()
	if err != nil {
		//fmt.Println(string(snykOutput))
		fmt.Println(err)
		//return err
	}

	snykOutputLength := len(snykOutput)
	if snykOutputLength <= 0 {
		return fmt.Errorf("No dependency graphs found")
	}

	separatedJsonRawData := bytes.Split(snykOutput, jsonSeparatorEnd)
	for i := range separatedJsonRawData {
		rawData := separatedJsonRawData[i]
		if bytes.Contains(rawData, jsonSeparatorData) {
			graphStartIndex := bytes.Index(rawData, jsonSeparatorData) + len(jsonSeparatorData)
			graphEndIndex := bytes.Index(rawData, jsonSeparatorTarget)
			targetNameStartIndex := graphEndIndex + len(jsonSeparatorTarget)
			targetNameEndIndex := len(rawData) - 1

			targetName := rawData[targetNameStartIndex:targetNameEndIndex]
			depGraphJson := rawData[graphStartIndex:graphEndIndex]

			requestList = append(requestList, sbomInvocation{
				targetName:   strings.TrimSpace(string(targetName)),
				depGraphJson: depGraphJson,
			})
		}
	}

	for i := range requestList {
		fmt.Printf("Calling SBOM API for target '%s'\n", requestList[i].targetName)
	}

	return nil
}

func main() {
	rootCommand := cobra.Command{
		Use:  "sbom",
		RunE: sbomFunc,
	}

	err := rootCommand.Execute()
	if err != nil {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}
