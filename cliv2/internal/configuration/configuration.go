package configuration

import (
	"os"
	"path"
	"strconv"
	"strings"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/spf13/viper"
)

const (
	API_URL                     string = "snyk_api"
	AUTHENTICATION_TOKEN        string = "token"
	AUTHENTICATION_BEARER_TOKEN string = "bearer_token"
	INTEGRATION_NAME            string = "snyk_integration_name"
	INTEGRATION_VERSION         string = "snyk_integration_version"
	ANALYTICS_DISABLED          string = "snyk_disable_analytics"
)

type Configuration interface {
	Get(key string) interface{}
	GetString(key string) string
	GetBool(key string) bool
}

type extendedViper struct {
	viper           *viper.Viper
	alternativeKeys map[string][]string
	defaultValues   map[string]interface{}
}

func determineBasePath() string {
	homedir, err := os.UserHomeDir()
	if err != nil {
		return "."
	}

	result := path.Join(homedir, ".config", "configstore")
	return result
}

func CreateConfigurationFile(filename string) (string, error) {
	configPath := determineBasePath()
	filepath := path.Join(configPath, filename)

	folder := path.Dir(filepath)
	err := os.MkdirAll(folder, 0755)
	if err != nil {
		return "", err
	}

	// create empty file
	err = os.WriteFile(filepath, []byte{}, 0755)
	if err != nil {
		return "", err
	}

	return filepath, err
}

func NewFromFiles(files ...string) Configuration {
	config := &extendedViper{
		viper: viper.New(),
	}

	// prepare config files
	for _, file := range files {
		config.viper.SetConfigName(file)
	}

	configPath := determineBasePath()
	config.viper.AddConfigPath(configPath)
	config.viper.AddConfigPath(".")

	// prepare environment variables
	config.viper.SetEnvKeyReplacer(strings.NewReplacer("-", "_"))
	config.viper.AutomaticEnv()

	// Assign alternative keys to look up of the original is not found
	config.alternativeKeys = make(map[string][]string)
	config.alternativeKeys[AUTHENTICATION_TOKEN] = []string{"snyk_token", "snyk_cfg_api", "api"}
	config.alternativeKeys[AUTHENTICATION_BEARER_TOKEN] = []string{"snyk_oauth_token", "snyk_docker_token"}

	// Assign default values
	config.defaultValues = make(map[string]interface{})
	config.defaultValues[API_URL] = constants.SNYK_DEFAULT_API_URL
	config.defaultValues[ANALYTICS_DISABLED] = false

	// read config files
	config.viper.ReadInConfig()

	return config
}

func New() Configuration {
	config := NewFromFiles("snyk")
	return config
}

func (ev *extendedViper) Get(key string) interface{} {

	// try to lookup given key
	result := ev.viper.Get(key)

	// try to lookup alternative keys if available
	i := 0
	altKeys := ev.alternativeKeys[key]
	altKeysSize := len(altKeys)
	for result == nil && i < altKeysSize {
		tempKey := altKeys[i]
		result = ev.viper.Get(tempKey)
		i++
	}

	if result == nil {
		if ev.defaultValues[key] != nil {
			result = ev.defaultValues[key]
		}
	}

	return result
}

func (ev *extendedViper) GetString(key string) string {
	result := ev.Get(key)
	if result == nil {
		return ""
	}
	return result.(string)
}

func (ev *extendedViper) GetBool(key string) bool {
	result := ev.Get(key)
	if result == nil {
		return false
	}

	switch result.(type) {
	case bool:
		return result.(bool)
	case string:
		stringResult := result.(string)
		boolResult, _ := strconv.ParseBool(stringResult)
		return boolResult
	}

	return false
}
