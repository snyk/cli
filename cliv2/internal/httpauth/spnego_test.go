package httpauth

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

//go:generate $GOPATH/bin/mockgen -source=spnego.go -destination ./spnego_generated_mock.go -package httpauth -self_package github.com/snyk/cli/cliv2/internal/httpauth

func fixturePath() string {
	path, _ := filepath.Abs(filepath.Join("..", "..", "internal", "httpauth", "test", "fixtures"))
	return path
}

func dockerComposeFile() string {
	path := filepath.Join(fixturePath(), "squid_environment", "docker-compose.yml")
	return path
}

func scriptsPath() string {
	path := filepath.Join(fixturePath(), "squid_environment", "scripts")
	return path
}

func hasDockerInstalled() bool {
	result := false
	cmd := exec.Command("docker-compose", "--version")
	err := cmd.Run()
	if err == nil {
		result = true
	}
	return result
}

func runTestUsingExternalAuthLibrary() bool {
	result := false
	os := runtime.GOOS
	if os == "windows" {
		result = true
	} else {
		result = hasDockerInstalled()
	}
	return result
}

func runDockerCompose(arg ...string) {
	cmd := exec.Command("docker-compose", arg...)
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "HTTP_PROXY_PORT=3128")
	cmd.Env = append(cmd.Env, "PROXY_HOSTNAME=proxy.snyk.local")
	cmd.Env = append(cmd.Env, "CONTAINER_NAME=spnego_test")
	cmd.Env = append(cmd.Env, "SCRIPTS_PATH="+scriptsPath())
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	run := func() {
		err := cmd.Run()
		if err != nil {
			fmt.Println(err)
		}
	}
	run()
}

func startProxyEnvironment() {
	stopProxyEnvironment()
	runDockerCompose("--file", dockerComposeFile(), "up", "--build", "--detach")
}

func stopProxyEnvironment() {
	runDockerCompose("--file", dockerComposeFile(), "down")
}

func waitForFile(filename string, timeout time.Duration) {
	start := time.Now()
	for {
		_, err := os.Stat(filename)
		if !os.IsNotExist(err) {
			break
		}

		if time.Since(start) >= timeout {
			fmt.Println("waitForFile() - timeout", filename)
			break
		}

		time.Sleep(time.Second)

	}
}

func Test_IsNTLMToken(t *testing.T) {
	ntlmToken := "TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA"
	assert.True(t, IsNTLMToken(ntlmToken))

	nonNtlmToken := "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"
	assert.False(t, IsNTLMToken(nonNtlmToken))
}

func Test_GetMechanismsFromHttpFieldValue_NTLM(t *testing.T) {
	ntlmToken := "TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA"
	expected := NTLMSSP_NAME
	actual, err := GetMechanismsFromHttpFieldValue(ntlmToken)
	assert.Nil(t, err)
	assert.Equal(t, actual[0], expected)
}

func Test_GetMechanismsFromHttpFieldValue_NTLM_Negotiate(t *testing.T) {
	ntlmToken := "Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA"
	expected := NTLMSSP_NAME
	actual, err := GetMechanismsFromHttpFieldValue(ntlmToken)
	assert.Nil(t, err)
	assert.Contains(t, actual[0], expected)
}

func Test_GetMechanismsFromHttpFieldValue_Multiple(t *testing.T) {
	ntlmToken := "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"
	expected := SPNEGO_NAME
	actual, err := GetMechanismsFromHttpFieldValue(ntlmToken)
	assert.Nil(t, err)
	assert.Contains(t, actual, expected)
}

// This is a very simplistic test for basic coverage. It is not supposed to recreate a functional setup
func Test_GetToken(t *testing.T) {

	if !runTestUsingExternalAuthLibrary() {
		t.Skip("This test can't be run in this environment.")
	}

	dockerInstalled := hasDockerInstalled()
	if dockerInstalled {
		startProxyEnvironment()
	}

	config := filepath.Join(fixturePath(), "squid_environment", "scripts", "krb5.conf")
	cache := filepath.Join(fixturePath(), "squid_environment", "scripts", "krb5_cache")
	waitForFile(config, time.Second*30)

	os.Setenv("KRB5CCNAME", "FILE:"+cache)
	os.Setenv("KRB5_CONFIG", config)

	url, _ := url.Parse("https://localhost:3128")
	initialToken := ""
	expectedDone := false

	provider := SpnegoProviderInstance()
	actualToken, done, err := provider.GetToken(url, initialToken)

	assert.NotEmpty(t, actualToken)
	assert.Equal(t, expectedDone, done)
	assert.Nil(t, err)

	fmt.Println(actualToken)

	if dockerInstalled {
		stopProxyEnvironment()
	}

	os.Remove(config)
	os.Remove(cache)
}
