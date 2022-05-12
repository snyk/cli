package extensions

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	// "github.com/snyk/cli/cliv2/internal/cliv2"
)

type InputData struct {
	// TODO: what standard stuff needs to go here?
	TBDMetadata string `json:"tbd"`

	// Extension-specific args
	Args any `json:"args"`
}

func MakeLaunchCodes(extensionMetadata *ExtensionMetadata, args []string, debugLogger *log.Logger) (string, error) {
	log.Println("making launch codes for extension:", extensionMetadata.Name)

	// TODO: this needs to be dynamic based on
	//   1) the extension's metadata file describing its inputs
	//   2) the args passed into the CLI
	// maybe we could generate a pflag (or just flag) config based on the metadata file and use that
	// to build this map?
	extensionArgs := map[string]string{}
	extensionArgs["lang"] = "foo"

	extensionLaunchCodes := InputData{
		TBDMetadata: "some metadata", // TODO: just a placeholder until we figure out what field(s) we need here
		Args:        extensionArgs,
	}

	launchCodesSerializedBytes, err := json.Marshal(extensionLaunchCodes)
	if err != nil {
		log.Println("error marshalling extension startup message:", err)
		return "", err
	}

	launchCodesSerializedString := string(launchCodesSerializedBytes)
	return string(launchCodesSerializedString), nil
}

func LaunchExtension(extension *Extension, args []string, proxyPort int, caCertLocation string, debugLogger *log.Logger) int {
	log.Println("launching extension:", extension.ExtensionMetadata.Name)

	launchCodes, err := MakeLaunchCodes(extension.ExtensionMetadata, args, debugLogger)
	if err != nil {
		panic(err) // TODO
	}

	log.Println("launchCodes:\n", launchCodes)

	extensionPath, err := extension.ExecutablePath(debugLogger)
	if err != nil {
		log.Println("error getting extension path:", err)
		return 2 //cliv2.SNYK_EXIT_CODE_ERROR
	}

	log.Println("extensionPath:", extensionPath)

	cmd := exec.Command(extensionPath)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("HTTPS_PROXY=http://127.0.0.1:%d", proxyPort),
		fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", caCertLocation),
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	buffer := bytes.Buffer{}
	buffer.WriteString(launchCodes)
	buffer.WriteString("\n\n")
	cmd.Stdin = &buffer

	cmd.Start()
	err = cmd.Wait()

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode := exitError.ExitCode()
			return exitCode
		} else {
			// got an error but it's not an ExitError
			fmt.Println("error launching extension:", err)
			return 2 //cliv2.SNYK_EXIT_CODE_ERROR
		}
	}

	return 0 // cliv2.SNYK_EXIT_CODE_OK
}
