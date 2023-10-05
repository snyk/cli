package basic_workflows

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_FilteredArgs(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := FilteredArgs([]string{"a", "b", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_FilteredArgs_doubleDashNotAppend(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "x"}
	actual := FilteredArgs([]string{"a", "b", "c", "--", "x"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_FilteredArgs_(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := FilteredArgs([]string{"a", "b", "--proxy-noauth", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}
