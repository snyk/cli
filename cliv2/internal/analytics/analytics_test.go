package analytics

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/user"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_Basic(t *testing.T) {
	os.Setenv("CIRCLECI", "true")

	api := "http://myapi.com"
	org := "MyOrgAs"
	h := http.Header{}
	h.Add("Authorization", "token 4ac534fac6fd6790b7")

	// prepare test data
	args := []string{"test", "--flag", "b=1"}
	for i := range sensitiveFieldNames {
		args = append(args, fmt.Sprintf("%s=%s", sensitiveFieldNames[i], "secretvalue"))
	}

	analytics := New()
	analytics.SetCmdArguments(args)
	analytics.AddError(fmt.Errorf("Something went terrible wrong."))
	analytics.SetVersion("1234567")
	analytics.SetOrg(org)
	analytics.SetApiUrl(api)
	analytics.SetIntegration("Jenkins", "1.2.3.4")
	analytics.AddHeader(func() http.Header {
		return h.Clone()
	})

	// invoke method under test
	request, err := analytics.GetRequest()

	// compare results
	assert.Nil(t, err)
	assert.NotNil(t, request)
	assert.True(t, analytics.IsCiEnvironment())

	expectedAuthHeader, _ := h["Authorization"]
	actualAuthHeader, _ := request.Header["Authorization"]
	assert.Equal(t, expectedAuthHeader, actualAuthHeader)

	requestUrl := request.URL.String()
	assert.True(t, strings.Contains(requestUrl, api))
	assert.True(t, strings.Contains(requestUrl, org))

	body, err := io.ReadAll(request.Body)
	assert.Nil(t, err)
	assert.Equal(t, len(sensitiveFieldNames), strings.Count(string(body), sanitize_replacement_string), "Not all sensitive values have been replaced!")

	fmt.Println("Request Url: " + requestUrl)
	fmt.Println("Request Body: " + string(body))
}

func Test_SanitizeValuesByKey(t *testing.T) {
	secretValues := []string{"mypassword", "123", "#er+aVnqOjnyTtzn-snyk", "Patch", "DogsRule"}
	expectedNumberOfRedacted := len(secretValues)

	type sanTest struct {
		Password           string `json:"password"`
		JenkinsPassword    string
		PrivateKeySecret   string
		SecretNumber       int
		TotallyPublicValue bool
		Args               []string
	}

	inputStruct := sanTest{
		Password:           secretValues[2],
		JenkinsPassword:    secretValues[0],
		PrivateKeySecret:   secretValues[1],
		SecretNumber:       987654,
		TotallyPublicValue: false,
		Args:               []string{"--username=" + secretValues[3], "password=" + secretValues[4], "something=else"},
	}

	// test input
	filter := []string{"password", "Secret", "username"}
	input, _ := json.Marshal(inputStruct)
	replacement := "REDACTED"

	fmt.Println("Before: " + string(input))

	// invoke method under test
	output, err := SanitizeValuesByKey(filter, replacement, input)

	fmt.Println("After: " + string(output))

	assert.Nil(t, err, "Failed to santize!")
	actualNumberOfRedacted := strings.Count(string(output), replacement)
	assert.Equal(t, expectedNumberOfRedacted, actualNumberOfRedacted)

	var outputStruct sanTest
	err = json.Unmarshal(output, &outputStruct)
	assert.Nil(t, err, "Failed to decode json object!")

	// count how often the known secrets are being found in the input and the output
	secretsCountAfter := 0
	secretsCountBefore := 0
	for i := range secretValues {
		secretsCountBefore += strings.Count(string(input), secretValues[i])
		secretsCountAfter += strings.Count(string(output), secretValues[i])
	}
	assert.Equal(t, expectedNumberOfRedacted, secretsCountBefore)
	assert.Equal(t, 0, secretsCountAfter)
}

func Test_SanitizeUsername(t *testing.T) {
	type sanTest struct {
		ErrorLog string
		Other    string
	}

	type input struct {
		userName     string
		domainPrefix string
		homeDir      string
	}

	user, err := user.Current()
	assert.Nil(t, err)

	// runs 3 cases
	// 1. without domain name
	// 2. with domain name
	// 3. user name and path are different
	// 4. current OS values
	replacement := "REDACTED"
	inputData := []input{
		{
			userName:     "some.user",
			domainPrefix: "",
			homeDir:      `/Users/some.user/some/Path`,
		},
		{
			userName:     "some.user",
			domainPrefix: "domainName\\",
			homeDir:      `C:\Users\some.user\AppData\Local`,
		},
		{
			userName:     "someuser",
			domainPrefix: "domainName\\",
			homeDir:      `C:\Users\some.user\AppData/Local`,
		},
		{
			userName:     user.Username,
			domainPrefix: "",
			homeDir:      user.HomeDir,
		},
	}

	for i := range inputData {
		simpleUsername := inputData[i].userName
		rawUserName := inputData[i].domainPrefix + inputData[i].userName
		homeDir := inputData[i].homeDir

		inputStruct := sanTest{
			ErrorLog: fmt.Sprintf(`Can't execute %s\path/to/something/file.exe for whatever reason.`, homeDir),
			Other:    fmt.Sprintf("some other value where %s is contained", rawUserName),
		}

		input, _ := json.Marshal(inputStruct)
		fmt.Printf("%d - Before: %s\n", i, string(input))

		// invoke method under test
		output, err := SanitizeUsername(rawUserName, homeDir, replacement, input)

		fmt.Printf("%d - After: %s\n", i, string(output))
		assert.Nil(t, err, "Failed to santize static values!")

		numRedacted := strings.Count(string(output), replacement)
		assert.Equal(t, 2, numRedacted)

		numUsernameInstances := strings.Count(string(output), rawUserName)
		assert.Equal(t, 0, numUsernameInstances)

		numSimpleUsernameInstances := strings.Count(string(output), simpleUsername)
		assert.Equal(t, 0, numSimpleUsernameInstances)

		numHomeDirInstances := strings.Count(string(output), homeDir)
		assert.Equal(t, 0, numHomeDirInstances)

		var outputStruct sanTest
		json.Unmarshal(output, &outputStruct)

	}

}
