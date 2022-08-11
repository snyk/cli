package configuration

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path"
	"strings"

	"github.com/snyk/cli/cliv2/internal/utils"
)

type Configstore struct {
	basePath   string
	configfile string
	content    map[string]interface{}
}

type ConfigstoreInterface interface {
	Get(key string) (string, error)
	GetFilepath() string
	Create() error
	Exists() bool
}

func determineBasePath() string {
	homedir, err := os.UserHomeDir()
	if err != nil {
		fmt.Println("Failed to deterine user home dir!")
		return "."
	}

	result := path.Join(homedir, ".config", "configstore")
	return result
}

func NewConfigstore() ConfigstoreInterface {
	return NewConfigstoreWithFilename("snyk.json")
}

func NewConfigstoreWithFilename(filename string) ConfigstoreInterface {
	c := &Configstore{
		basePath:   determineBasePath(),
		configfile: filename,
	}

	filepath := c.GetFilepath()
	contentString, err := ioutil.ReadFile(filepath)
	if err == nil {
		err = json.Unmarshal([]byte(contentString), &c.content)
	}

	return c
}

func (c *Configstore) Get(key string) (string, error) {

	strings.ReplaceAll(key, "-", "_")
	envKey := fmt.Sprintf("SNYK_CFG_%s", strings.ToUpper(strings.ReplaceAll(key, "-", "_")))
	envMapped := utils.ToKeyValueMap(os.Environ(), "=")
	result := envMapped[envKey]

	if len(result) == 0 {
		if c.content == nil {
			return "", fmt.Errorf("Configstore doesn't exist and can't be read from.")
		}

		value := c.content[key]
		if value != nil {
			result = c.content[key].(string)
		} else {
			return "", fmt.Errorf("Key '%s' not found.", key)
		}
	}
	return result, nil
}

func (c *Configstore) GetFilepath() string {
	file := path.Join(c.basePath, c.configfile)
	return file
}

func (c *Configstore) Create() error {
	if c.Exists() == false {
		file := c.GetFilepath()

		// create folder
		folder := path.Dir(file)
		err := os.MkdirAll(folder, 0755)
		if err != nil {
			return err
		}

		// create empty file
		err = os.WriteFile(file, []byte{}, 0755)
		if err != nil {
			return err
		}
	}

	return nil
}

func (c *Configstore) Exists() bool {
	file := c.GetFilepath()
	_, err := os.Stat(file)
	return !os.IsNotExist(err)
}
