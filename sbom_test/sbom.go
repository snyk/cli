package main

import (
	"bytes"
	"fmt"
	"io/fs"
	"net/http"
	"net/url"
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

type workflowData struct {
	identifier *url.URL
	header     http.Header
	payload    interface{}
}

func depGraphWorkflow(cmd *cobra.Command, args []string) (error, []workflowData) {
	var depGraphList []workflowData

	snykCmd := "node"
	snykCmdArguments := []string{"../dist/cli/index.js", "test", "--print-graph", "--json"}

	if allProjects, _ := cmd.Flags().GetBool("all-projects"); allProjects {
		snykCmdArguments = append(snykCmdArguments, "--all-projects")
	}

	if len(args) > 0 {
		snykCmdArguments = append(snykCmdArguments, args[0])
	}

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
			id, _ := url.Parse("did://depgraph/depgraph#2135546")

			data := workflowData{
				identifier: id,
				header:     http.Header{"mime-type": {"application/json"}},
				payload: depGraph{
					targetName:   strings.TrimSpace(string(targetName)),
					depGraphJson: depGraphJson,
				},
			}

			depGraphList = append(depGraphList, data)
		}
	}

	return nil, depGraphList
}

func sbomWorkflow(cmd *cobra.Command, args []string) (error, []workflowData) {
	var sbomList []workflowData

	debug, _ := cmd.Flags().GetBool("debug")

	err, depGraphData := depGraphWorkflow(cmd, args)
	if err != nil {
		return err, nil
	}

	for i := range depGraphData {
		if depGraphData[i].identifier.Path == "/depgraph" {
			singleData := depGraphData[i].payload.(depGraph)

			if debug {
				fmt.Printf("(TODO) Calling SBOM API for target '%s' (DepGraph Size: %.2f[KB])\n", singleData.targetName, (float64(len(singleData.depGraphJson)) / 1024.0))
			}

			sbom := singleData.depGraphJson

			id, _ := url.Parse("did://sbom/cyclonedx#2135546")
			data := workflowData{
				identifier: id,
				header:     http.Header{"mime-type": {"application/json"}},
				payload:    sbom,
			}

			sbomList = append(sbomList, data)
		}
	}

	return nil, sbomList
}

func output(cmd *cobra.Command, args []string) error {
	err, data := sbomWorkflow(cmd, args)
	if err != nil {
		return err
	}

	debug, _ := cmd.Flags().GetBool("debug")
	printJsonToCmd, _ := cmd.Flags().GetBool("json")
	writeJsonToFile, _ := cmd.Flags().GetString("json-file-output")

	for i := range data {
		mimeType := data[i].header["mime-type"][0]

		if mimeType == "application/json" {
			singleData := data[i].payload.([]byte)

			if printJsonToCmd {
				fmt.Println(string(singleData))
			}

			if len(writeJsonToFile) > 0 {
				if debug {
					fmt.Printf("Writing '%s' JSON of length %d to '%s'\n", data[i].identifier.Path, len(singleData), writeJsonToFile)
				}

				os.WriteFile(writeJsonToFile, singleData, fs.FileMode(0577))
			}

		}
	}

	return nil
}

func main() {
	rootCommand := cobra.Command{
		Use:  "sbom",
		Args: cobra.MaximumNArgs(1),
		RunE: output,
	}

	rootCommand.Flags().Bool("json", false, "Print json output to console")
	rootCommand.Flags().String("json-file-output", "", "Write json output to file")
	rootCommand.PersistentFlags().Bool("all-projects", false, "Enable all projects")
	rootCommand.PersistentFlags().BoolP("debug", "d", false, "Enable debug output")

	err := rootCommand.Execute()
	if err != nil {
		os.Exit(1)
	} else {
		os.Exit(0)
	}
}
