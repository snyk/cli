// This is a very simplified example on how Workflows, Configuration and Legacy CLI can work together to build an Extensible CLI.
// It doesn't have the goal to be perfectly programmed nor to represent a final implementation proposal. It is meant as a supplement to the associated Pitch.
package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

type WorkflowData struct {
	identifier *url.URL
	header     http.Header
	payload    interface{}
}

type Config struct {
	cmd    *cobra.Command
	args   []string
	values map[string]interface{}
}

type WorkflowEntry struct {
	visible               bool
	expectedConfiguration *pflag.FlagSet
	entryPoint            func(c *Config, input []WorkflowData) (error, []WorkflowData)
}

type WorkflowEngine struct {
	workflows map[string]WorkflowEntry
	Config    *Config
}

var WorkflowEngineInstance *WorkflowEngine
var helpProvided bool = false
var logger log.Logger

func NewWorkflowDataFromInput(input *WorkflowData, id string, contentType string, data interface{}) *WorkflowData {
	output := NewWorkflowData(id, contentType, data)
	output.identifier.Fragment = input.identifier.Fragment
	return output
}

func NewWorkflowData(id string, contentType string, data interface{}) *WorkflowData {
	idUrl, _ := url.Parse(id)
	idUrl.Fragment = fmt.Sprintf("%d", time.Now().Nanosecond())
	output := &WorkflowData{
		identifier: idUrl,
		header: http.Header{
			"Content-Type": {contentType},
		},
		payload: data,
	}

	return output
}

// ***
// Config
// ***
func (c *Config) Update(cmd *cobra.Command, args []string) {
	c.args = args
	c.cmd = cmd

	if len(args) > 0 {
		c.SetString("targetDirectory", args[0])
	}

}

func (c *Config) GetBool(name string) (bool, error) {
	value, ok := c.values[name]
	if ok {
		return value.(bool), nil
	}

	return c.cmd.Flags().GetBool(name)
}

func (c *Config) SetBool(name string, value bool) {
	c.values[name] = value
}

func (c *Config) SetString(name string, value string) {
	c.values[name] = value
}

func (c *Config) GetString(name string) (string, error) {
	value, ok := c.values[name]
	if ok {
		return value.(string), nil
	}

	return c.cmd.Flags().GetString(name)
}

func (c *Config) SetStringSlice(name string, value []string) {
	c.values[name] = value
}

func (c *Config) GetStringSlice(name string) ([]string, error) {
	value, ok := c.values[name]
	if ok {
		return value.([]string), nil
	}

	return c.cmd.Flags().GetStringSlice(name)
}

// ***
// WorkflowEngine
// ***
func NewWorkflowEnginge() *WorkflowEngine {
	wfl := WorkflowEngine{}
	wfl.workflows = make(map[string]WorkflowEntry)
	wfl.Config = &Config{
		cmd:    &cobra.Command{},
		values: make(map[string]interface{}),
	}
	return &wfl
}

func (w *WorkflowEngine) InvokeWorkflowWithData(name string, input []WorkflowData) (error, []WorkflowData) {
	var result []WorkflowData
	var err error

	workflow, ok := w.workflows[name]
	if ok {
		err, result = workflow.entryPoint(w.Config, input)
	} else {
		err = fmt.Errorf("Workflow '%s' not found.", name)
	}

	if err != nil {
		logger.Println("Workflow returned an error:", err)
	}

	return err, result
}

func (w *WorkflowEngine) InvokeWorkflow(name string) (error, []WorkflowData) {
	var input []WorkflowData
	return w.InvokeWorkflowWithData(name, input)
}

// ***
// Workflow: LegacyCLIWorkflow
// ***
func LegacyCLIWorkflow(c *Config, input []WorkflowData) (error, []WorkflowData) {
	var output []WorkflowData
	var err error

	debug, _ := c.GetBool("debug")
	additionalArgs, _ := c.GetStringSlice("legacy_cli_args")
	standalone, _ := c.GetBool("legacy_cli_standalone")

	snykCmd := "node"
	snykCmdArguments := []string{"../dist/cli/index.js"}
	snykCmdArguments = append(snykCmdArguments, additionalArgs...)

	if file, _ := c.GetString("file"); len(file) > 0 {
		snykCmdArguments = append(snykCmdArguments, "--file="+file)
	}

	snykCommand := exec.Command(snykCmd, snykCmdArguments...)

	if debug {
		standaloneString := ""
		if standalone {
			standaloneString = " (Standalone)"
		}

		logger.Printf("Executing legacy cli%s: %s\n", standaloneString, snykCommand)
	}

	if standalone {
		snykCommand.Stdin = os.Stdin
		snykCommand.Stdout = os.Stdout
		snykCommand.Stderr = os.Stderr
		err = snykCommand.Run()
	} else {
		var snykOutput []byte
		snykOutput, err = snykCommand.Output()

		data := NewWorkflowData("did://legacy/cmd", "text/plain", snykOutput)
		output = append(output, *data)
	}

	return err, output
}

// ***
// Workflow: depGraph
// ***
func DepGraphWorkflow(c *Config, input []WorkflowData) (error, []WorkflowData) {
	var depGraphList []WorkflowData

	jsonSeparatorEnd := []byte("DepGraph end")
	jsonSeparatorData := []byte("DepGraph data:")
	jsonSeparatorTarget := []byte("DepGraph target:")

	// prepare invocation of the legacy cli
	snykCmdArguments := []string{"test", "--print-graph", "--json"}
	if allProjects, _ := c.GetBool("all-projects"); allProjects {
		snykCmdArguments = append(snykCmdArguments, "--all-projects")
	}

	if targetDirectory, err := c.GetString("targetDirectory"); err == nil {
		snykCmdArguments = append(snykCmdArguments, targetDirectory)
	}

	c.SetStringSlice("legacy_cli_args", snykCmdArguments)
	legacyCLIError, legacyData := WorkflowEngineInstance.InvokeWorkflow("legacy_cli")
	if legacyCLIError != nil {
		return legacyCLIError, depGraphList
	}

	snykOutput := legacyData[0].payload.([]byte)

	snykOutputLength := len(snykOutput)
	if snykOutputLength <= 0 {
		return fmt.Errorf("No dependency graphs found"), nil
	}

	// split up dependency data from legacy cli
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

			data := NewWorkflowData("did://depgraph/depgraph", "application/json", depGraphJson)
			data.header.Add("Content-Location", strings.TrimSpace(string(targetName)))
			depGraphList = append(depGraphList, *data)
		}
	}

	logger.Printf("depgraph workflow done (%d)", len(depGraphList))

	return nil, depGraphList
}

// ***
// Workflow: sbom
// ***
func SbomWorkflow(c *Config, input []WorkflowData) (error, []WorkflowData) {
	var sbomList []WorkflowData

	// invoke depgraph
	err, depGraphData := WorkflowEngineInstance.InvokeWorkflow("depgraph")
	if err != nil {
		return err, nil
	}

	// iterate over depgraphs and generate sbom
	for i := range depGraphData {
		if depGraphData[i].identifier.Path == "/depgraph" {
			singleData := depGraphData[i].payload.([]byte)
			targetName := depGraphData[i].header["Content-Location"][0]

			logger.Printf("Calling SBOM API for target '%s' (DepGraph Size: %.2f[KB])\n", targetName, (float64(len(singleData)) / 1024.0))

			sbom, err := convertDepGraphToSBOM(context.Background(), c, singleData, "cyclonedx+json")
			if err != nil {
				return err, nil
			}

			// create output data
			data := NewWorkflowDataFromInput(&depGraphData[i], "did://sbom/cyclonedx", "application/vnd.cyclonedx+json", sbom)
			sbomList = append(sbomList, *data)
		}
	}

	return nil, sbomList
}

func convertDepGraphToSBOM(ctx context.Context, c *Config, depGraph []byte, format string) (sbom []byte, err error) {
	baseURL := "https://api.dev.snyk.io"
	apiVersion := "2022-03-31~experimental"
	token, _ := c.GetString("token")
	orgID, _ := c.GetString("org")

	url := fmt.Sprintf(
		"%s/hidden/orgs/%s/sbom?version=%s&format=%s",
		baseURL, orgID, apiVersion, url.QueryEscape(format),
	)

	body := bytes.NewBuffer([]byte(fmt.Sprintf(`{"depGraph":%s}`, depGraph)))

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	req.Header.Set("Authorization", fmt.Sprintf("token %s", token))
	req.Header.Set("Content-Type", "application/json")
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("could not convert to SBOM (status: %s)", resp.Status)
	}

	if resp.Header.Get("Content-Type") != "application/vnd.cyclonedx+json" {
		return nil, errors.New("received unexpected response format")
	}

	sbom, err = io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return sbom, nil
}

// ***
// Workflow: output
// ***
func OutputWorkflow(c *Config, input []WorkflowData) (error, []WorkflowData) {
	var empty []WorkflowData

	printJsonToCmd, _ := c.GetBool("json")
	writeJsonToFile, _ := c.GetString("json-file-output")

	for i := range input {
		mimeType := input[i].header["Content-Type"][0]

		logger.Printf("Processing '%s' of type '%s'\n", input[i].identifier, mimeType)

		if strings.Contains(mimeType, "json") { // handle application/json
			singleData := input[i].payload.([]byte)

			if printJsonToCmd {
				fmt.Println(string(singleData))
			}

			if len(writeJsonToFile) > 0 {
				logger.Printf("Writing '%s' JSON of length %d to '%s'\n", input[i].identifier.Path, len(singleData), writeJsonToFile)

				os.Remove(writeJsonToFile)
				os.WriteFile(writeJsonToFile, singleData, fs.FileMode(0666))
			}
		} else if mimeType == "text/plain" { // handle text/pain
			singleData := input[i].payload.([]byte)
			fmt.Println(string(singleData))
		} else {
			err := fmt.Errorf("Unsupported output type: %s", mimeType)
			return err, empty
		}
	}

	return nil, empty
}

func init() {
	WorkflowEngineInstance = NewWorkflowEnginge()

	// init & register depgraph
	depGraphConfig := pflag.NewFlagSet("depgraph", pflag.ExitOnError)
	depGraphConfig.Bool("all-projects", false, "Enable all projects")
	depGraphConfig.String("file", "", "Input file")
	WorkflowEngineInstance.workflows["depgraph"] = WorkflowEntry{
		visible:               true,
		expectedConfiguration: depGraphConfig,
		entryPoint:            DepGraphWorkflow,
	}

	// init & register sbom
	sbomConfig := pflag.NewFlagSet("sbom", pflag.ExitOnError)
	sbomConfig.String("file", "", "Input file")
	WorkflowEngineInstance.workflows["sbom"] = WorkflowEntry{
		visible:               true,
		expectedConfiguration: sbomConfig,
		entryPoint:            SbomWorkflow,
	}

	// init & register LegacyCLIWorkflow
	WorkflowEngineInstance.workflows["legacy_cli"] = WorkflowEntry{
		visible:    false,
		entryPoint: LegacyCLIWorkflow,
	}

	// init & register output
	outputConfig := pflag.NewFlagSet("output", pflag.ExitOnError)
	outputConfig.Bool("json", false, "Print json output to console")
	outputConfig.String("json-file-output", "", "Write json output to file")
	WorkflowEngineInstance.workflows["output"] = WorkflowEntry{
		visible:               false,
		expectedConfiguration: outputConfig,
		entryPoint:            OutputWorkflow,
	}
}

// main workflow
func run(cmd *cobra.Command, args []string) error {
	WorkflowEngineInstance.Config.Update(cmd, args)

	debug, _ := WorkflowEngineInstance.Config.GetBool("debug")
	if debug == true {
		logger.SetOutput(os.Stderr)
	}

	name := cmd.Name()
	logger.Println("Running", name)

	err, data := WorkflowEngineInstance.InvokeWorkflow(name)
	if err == nil {
		err, data = WorkflowEngineInstance.InvokeWorkflowWithData("output", data)
	} else {
		fmt.Println("Failed to execute the command!", err)
	}

	return nil
}

func usage(cmd *cobra.Command) error {
	helpProvided = true
	return defaultCmd(cmd, []string{})
}

func help(cmd *cobra.Command, args []string) {
	helpProvided = true
	defaultCmd(cmd, args)
}

func defaultCmd(cmd *cobra.Command, args []string) error {
	WorkflowEngineInstance.Config.SetStringSlice("legacy_cli_args", os.Args[1:])
	WorkflowEngineInstance.Config.SetBool("legacy_cli_standalone", true)
	err, _ := WorkflowEngineInstance.InvokeWorkflow("legacy_cli")
	return err
}

func main() {
	logger = *log.Default()
	logger.SetOutput(io.Discard)

	rootCommand := cobra.Command{
		Use: "snyk",
	}

	helpCommand := cobra.Command{
		Use: "help",
		Run: help,
	}

	// init commands based on available workflows
	for k, v := range WorkflowEngineInstance.workflows {
		if v.visible {
			cmd := cobra.Command{
				Use:  k,
				Args: cobra.MaximumNArgs(1),
				RunE: run,
			}

			if v.expectedConfiguration != nil {
				cmd.Flags().AddFlagSet(v.expectedConfiguration)
			}

			rootCommand.AddCommand(&cmd)
		}
	}

	// some static/global cobra configuration
	rootCommand.CompletionOptions.DisableDefaultCmd = true
	rootCommand.SilenceErrors = true

	rootCommand.PersistentFlags().BoolP("debug", "d", false, "Enable debug output")
	rootCommand.PersistentFlags().String("org", "", "Set org context")
	rootCommand.PersistentFlags().String("token", "", "Snyk API token")
	rootCommand.PersistentFlags().AddFlagSet(WorkflowEngineInstance.workflows["output"].expectedConfiguration)

	// ensure that help and usage information comes from the legacy cli instead of cobra's default help
	rootCommand.SetHelpFunc(help)
	rootCommand.SetUsageFunc(usage)
	rootCommand.SetHelpCommand(&helpCommand)

	// run the extensible cli
	err := rootCommand.Execute()

	// fallback to the legacy cli
	if err != nil && helpProvided == false {
		err = defaultCmd(nil, []string{})
	}

	if err != nil {
		exitCode := 1
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		}
		os.Exit(exitCode)
	} else {
		os.Exit(0)
	}
}
