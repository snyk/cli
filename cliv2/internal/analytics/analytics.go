package analytics

import (
	"bytes"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/user"
	"regexp"
	"runtime"
	"strings"
	"time"

	"github.com/hashicorp/go-uuid"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type Analytics struct {
	headerFunc func() http.Header
	apiUrl     string

	org                string
	version            string
	created            time.Time
	args               []string
	errorList          []error
	integrationName    string
	integrationVersion string
}

type metadataOutput struct {
	ErrorMessage string `json:"error-message,omitempty"`
	ErrorCode    string `json:"error-code,omitempty"`
}

type metricsOutput struct {
}

type analyticsOutput struct {
	Command                       string         `json:"command"`
	Args                          []string       `json:"args"`
	OsPlatform                    string         `json:"osPlatform"`
	OsArch                        string         `json:"osArch"`
	Os                            string         `json:"os"`
	OsRelease                     string         `json:"osRelease"`
	Metadata                      metadataOutput `json:"metadata"`
	Id                            string         `json:"id"`
	Version                       string         `json:"version"`
	DurationMs                    int64          `json:"durationMs"`
	Metrics                       metricsOutput  `json:"metrics"`
	Ci                            bool           `json:"ci"`
	IntegrationName               string         `json:"integrationName"`
	IntegrationVersion            string         `json:"integrationVersion"`
	IntegrationEnvironment        string         `json:"integrationEnvironment"`
	IntegrationEnvironmentVersion string         `json:"integrationEnvironmentVersion"`
	NodeVersion                   string         `json:"nodeVersion"`
	Standalone                    bool           `json:"standalone"`
}

type dataOutput struct {
	Data analyticsOutput `json:"data"`
}

var (
	ciEnvironments []string = []string{
		"SNYK_CI",
		"CI",
		"CONTINUOUS_INTEGRATION",
		"BUILD_ID",
		"BUILD_NUMBER",
		"TEAMCITY_VERSION",
		"TRAVIS",
		"CIRCLECI",
		"JENKINS_URL",
		"HUDSON_URL",
		"bamboo.buildKey",
		"PHPCI",
		"GOCD_SERVER_HOST",
		"BUILDKITE",
		"TF_BUILD",
		"SYSTEM_TEAMFOUNDATIONSERVERURI", // for Azure DevOps Pipelines
	}

	sensitiveFieldNames []string = []string{
		"tfc-token",
		"azurerm-account-key",
		"fetch-tfstate-headers",
		"username",
		"password",
	}
)

const (
	sanitize_replacement_string string = "REDACTED"
	api_endpoint                       = "/v1/analytics/cli"
)

func New() *Analytics {
	a := &Analytics{}
	a.headerFunc = func() http.Header { return http.Header{} }
	a.created = time.Now()
	return a
}

func (a *Analytics) SetCmdArguments(args []string) {
	a.args = args
}

func (a *Analytics) SetOrg(org string) {
	a.org = org
}

func (a *Analytics) SetVersion(version string) {
	a.version = version
}

func (a *Analytics) SetApiUrl(apiUrl string) {
	a.apiUrl = apiUrl
}

func (a *Analytics) SetIntegration(name string, version string) {
	a.integrationName = name
	a.integrationVersion = version
}

func (a *Analytics) AddError(err error) {
	a.errorList = append(a.errorList, err)
}

func (a *Analytics) AddHeader(headerFunc func() http.Header) {
	a.headerFunc = headerFunc
}

func (a *Analytics) IsCiEnvironment() bool {
	result := false

	envMap := utils.ToKeyValueMap(os.Environ(), "=")
	for i := range ciEnvironments {
		if _, ok := envMap[ciEnvironments[i]]; ok {
			result = true
			break
		}
	}

	return result
}

func (a *Analytics) GetOutputData() *analyticsOutput {
	output := &analyticsOutput{}

	errorCount := len(a.errorList)
	if errorCount > 0 {
		lastError := a.errorList[errorCount-1]
		output.Metadata = metadataOutput{
			ErrorMessage: lastError.Error(),
		}
	}

	// deepcode ignore InsecureHash: It is just being used to generate an id, without any security concerns
	shasum := sha1.New()
	uuid, _ := uuid.GenerateUUID()
	io.WriteString(shasum, uuid)
	output.Id = fmt.Sprintf("%x", shasum.Sum(nil))

	output.Args = a.args

	if len(a.args) > 0 {
		output.Command = a.args[0]
	}

	output.OsPlatform = runtime.GOOS
	output.OsArch = runtime.GOARCH
	output.Version = a.version
	output.NodeVersion = runtime.Version()
	output.Ci = a.IsCiEnvironment()
	output.IntegrationName = a.integrationName
	output.IntegrationVersion = a.integrationVersion
	output.DurationMs = int64(time.Since(a.created).Milliseconds())
	output.Standalone = true // standalone means binary deployment, which is always true for go applications.

	return output
}

func (a *Analytics) GetRequest() (*http.Request, error) {
	output := a.GetOutputData()

	outputJson, err := json.Marshal(dataOutput{Data: *output})
	if err != nil {
		return nil, err
	}

	outputJson, err = SanitizeValuesByKey(sensitiveFieldNames, sanitize_replacement_string, outputJson)
	if err != nil {
		return nil, err
	}

	user, err := user.Current()
	if err != nil {
		return nil, err
	}
	outputJson, err = SanitizeUsername(user.Username, sanitize_replacement_string, outputJson)
	if err != nil {
		return nil, err
	}

	analyticsUrl, _ := url.Parse(a.apiUrl + api_endpoint)
	if len(a.org) > 0 {
		query := url.Values{}
		query.Add("org", a.org)
		analyticsUrl.RawQuery = query.Encode()
	}

	body := bytes.NewReader(outputJson)
	request, err := http.NewRequest(http.MethodPost, analyticsUrl.String(), body)
	if err != nil {
		return nil, err
	}

	if a.headerFunc != nil {
		request.Header = a.headerFunc()
	}

	request.Header.Set("Content-Type", "application/json; charset=utf-8")

	return request, err
}

func (a *Analytics) Send() (*http.Response, error) {
	request, err := a.GetRequest()
	if err != nil {
		return nil, err
	}

	client := http.Client{}
	response, err := client.Do(request)

	return response, err
}

// This method sanitizes the given content by searching for key-value mappings. It thereby replaces all keys defined in keysToFilter by the replacement string
// Supported patterns are:
// * key : "value"
// * key = "value"
// * key = value
func SanitizeValuesByKey(keysToFilter []string, replacementValue string, content []byte) ([]byte, error) {
	for i := range keysToFilter {
		filter := keysToFilter[i]
		r, err := regexp.Compile("(?i)([\"']?\\w*" + filter + "\\w*\"?)(((\\s?[:]\\s?[\"'])[^\n\"']*([\"']))|((\\s?[=]\\s?[\"']?)[^\n\"']*([\"']?)))")
		if err != nil {
			return nil, err
		}

		content = r.ReplaceAll(content, []byte("${1}${4}${7}"+replacementValue+"${5}${8}"))
	}
	return content, nil
}

func SanitizeUsername(rawUserName string, replacementValue string, content []byte) ([]byte, error) {
	contentStr := string(content)
	contentStr = strings.ReplaceAll(contentStr, rawUserName, replacementValue)

	if strings.Contains(rawUserName, "\\") {
		segments := strings.Split(rawUserName, "\\")
		segmentsLen := len(segments)
		if segmentsLen < 2 {
			// this should never happen because we already checked for the existence of a backslash
			return nil, fmt.Errorf("could not sanitize username")
		} else if segmentsLen == 2 {
			simpleUsername := segments[1]
			contentStr = strings.ReplaceAll(contentStr, simpleUsername, replacementValue)
		} else {
			// don't recognize this format
			fmt.Println(segments)
			return nil, fmt.Errorf("could not sanitize username - unrecognized format")
		}
	}

	return []byte(contentStr), nil
}
