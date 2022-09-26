package main

import (
	"bytes"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
)

type depGraph struct {
	targetName   string
	depGraphJson []byte
}

type sbomInvocation struct {
	depGraph     depGraph
	sbomResponse []byte
}

func depGraphWorkflow() (error, interface{}) {
	var depGraphList []depGraph

	targetPath := ".."
	snykCmd := "node"
	snykCmdArguments := []string{"../dist/cli/index.js", "test", "--print-graph", "--json", "--all-projects", targetPath}

	jsonSeparatorEnd := []byte("DepGraph end")
	jsonSeparatorData := []byte("DepGraph data:")
	jsonSeparatorTarget := []byte("DepGraph target:")

	snykCommand := exec.Command(snykCmd, snykCmdArguments...)
	snykOutput, err := snykCommand.Output()
	if err != nil {
		fmt.Println(err)
	}

	snykOutputLength := len(snykOutput)
	if snykOutputLength <= 0 {
		return fmt.Errorf("No dependency graphs found"), nil
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

			depGraphList = append(depGraphList, depGraph{
				targetName:   strings.TrimSpace(string(targetName)),
				depGraphJson: depGraphJson,
			})
		}
	}

	return nil, depGraphList
}

func sbomWorkflow(cmd *cobra.Command, args []string) (error, interface{}) {
	var sbomList []sbomInvocation

	err, temp := depGraphWorkflow()
	if err != nil {
		return err, nil
	}

	depGraphList, ok := temp.([]depGraph)
	if !ok {
		return fmt.Errorf("Failed to reaid DepGraph results"), nil
	}

	for i := range depGraphList {
		fmt.Printf("(TODO) Calling SBOM API for target '%s' (DepGraph Size: %.2f[KB])\n", depGraphList[i].targetName, (float64(len(depGraphList[i].depGraphJson)) / 1024.0))

		sbomList = append(sbomList, sbomInvocation{
			depGraph:     depGraphList[i],
			sbomResponse: []byte("Coming soon!"),
		})
	}

	return nil, sbomList
}

func output(cmd *cobra.Command, args []string) error {
	err, result := sbomWorkflow(cmd, args)
	if err != nil {
		return err
	}

	sbomList, ok := result.([]sbomInvocation)
	if !ok {
		return fmt.Errorf("Failed to reaid DepGraph results")
	}

	for i := range sbomList {
		fmt.Printf("(TODO) Writing SBOM for target '%s'\n", sbomList[i].depGraph.targetName)
	}

	return nil
}

func main() {
	rootCommand := cobra.Command{
		Use:  "sbom",
		RunE: output,
	}

	err := rootCommand.Execute()
	if err != nil {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}
