package configuration

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

const (
	TEST_FILENAME string = "test.json"
)

func prepareConfigstore(content string) error {
	config := NewConfigstoreWithFilename(TEST_FILENAME)
	file := config.GetFilepath()
	err := ioutil.WriteFile(file, []byte(content), 0755)
	return err
}

func cleanupConfigstore() {
	config := NewConfigstoreWithFilename(TEST_FILENAME)
	file := config.GetFilepath()
	os.RemoveAll(file)
}

func Test_ConfigurationGet_success_file(t *testing.T) {
	expectedValue := "mytoken"
	assert.Nil(t, prepareConfigstore(`{"api": "mytoken", "somethingElse": 12}`))

	config := NewConfigstoreWithFilename(TEST_FILENAME)
	actualValue, err := config.Get("api")

	assert.Nil(t, err)
	assert.Equal(t, expectedValue, actualValue)

	cleanupConfigstore()
}

func Test_ConfigurationGet_success_env(t *testing.T) {
	expectedValue := "anotherToken"
	assert.Nil(t, prepareConfigstore(`{"api-addr": "mytoken", "somethingElse": 12}`))

	os.Setenv("SNYK_CFG_API_ADDR", expectedValue)

	config := NewConfigstoreWithFilename(TEST_FILENAME)
	actualValue, err := config.Get("api-addr")

	assert.Nil(t, err)
	assert.Equal(t, expectedValue, actualValue)

	cleanupConfigstore()
}

func Test_ConfigurationGet_fail01(t *testing.T) {
	assert.Nil(t, prepareConfigstore(`{"api": "mytoken", "somethingElse": 12}`))

	config := NewConfigstoreWithFilename(TEST_FILENAME)
	actualValue, err := config.Get("notthere")

	assert.NotNil(t, err)
	assert.Empty(t, actualValue)

	cleanupConfigstore()
}

func Test_ConfigurationGet_fail02(t *testing.T) {
	config := NewConfigstoreWithFilename(TEST_FILENAME)
	actualValue, err := config.Get("notthere")

	assert.NotNil(t, err)
	assert.Empty(t, actualValue)
}

func Test_ConfigurationGetFilepath(t *testing.T) {
	config := NewConfigstore()
	filename := config.GetFilepath()

	assert.Contains(t, filename, "snyk.json")
}
