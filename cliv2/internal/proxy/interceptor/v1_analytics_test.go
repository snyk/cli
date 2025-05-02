package interceptor

import (
	"reflect"
	"testing"
)

func TestFlattenAnalyticsPayload(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		expected   map[string]interface{}
		shouldFail bool
	}{
		{
			name: "basic nested structure",
			input: `{
				"data": {
					"command": "test",
					"nested": {
						"foobar": "123"
					}
				}
			}`,
			expected: map[string]interface{}{
				"legacycli::nested__foobar": "123",
			},
			shouldFail: false,
		},
		{
			name: "deeper nested structure",
			input: `{
				"data": {
					"command": "test",
					"metadata": {
						"things": {
							"otherThings": "123"
						}
					}
				}
			}`,
			expected: map[string]interface{}{
				"legacycli::metadata__things__otherThings": "123",
			},
			shouldFail: false,
		},
		{
			name: "with array values",
			input: `{
				"data": {
					"command": "test",
					"args": ["arg1", "arg2"],
					"metadata": {
						"tags": ["tag1", "tag2"]
					}
				}
			}`,
			expected: map[string]interface{}{
				"legacycli::metadata__tags": "[tag1 tag2]",
			},
			shouldFail: false,
		},
		{
			name:       "invalid JSON",
			input:      `{"data": invalid}`,
			shouldFail: true,
		},
		{
			name:       "missing data object",
			input:      `{"key": "value"}`,
			shouldFail: true,
		},
	}

	interceptor := v1AnalyticsInterceptor{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := interceptor.flattenAnalyticsPayload([]byte(tt.input))

			if (err != nil) != tt.shouldFail {
				t.Errorf("flattenAnalyticsPayload() error = %v, shouldFail %v", err, tt.shouldFail)
				return
			}

			if tt.shouldFail {
				return
			}

			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("flattenAnalyticsPayload() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestExcludedFields(t *testing.T) {
	tests := []struct {
		name       string
		input      string
		expected   map[string]interface{}
		shouldFail bool
	}{
		{
			name: "a flat structure with excluded fields",
			input: `{
				"data": {
					"command": "test",
					"foobar": "1.2.3"
				}
			}`,
			expected: map[string]interface{}{
				"legacycli::foobar": "1.2.3",
			},
		},
		{
			name: "a nested structure with nested excluded fields",
			input: `{
				"data": {
					"command": "test",
					"nested": {
						"foo": "bar",
						"osArch": "amd64",
						"osPlatform": "linux"
					}
				}
			}`,
			expected: map[string]interface{}{
				"legacycli::nested__foo": "bar",
			},
		},
		{
			name: "a nested structure with excluded top field",
			input: `{
				"data": {
					"platform": {
						"foo": "bar",
						"osArch": "amd64",
						"osPlatform": "linux"
					}
				}
			}`,
			expected: map[string]interface{}{},
		},
	}

	interceptor := v1AnalyticsInterceptor{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := interceptor.flattenAnalyticsPayload([]byte(tt.input))

			if (err != nil) != tt.shouldFail {
				t.Errorf("flattenAnalyticsPayload() error = %v, shouldFail %v", err, tt.shouldFail)
				return
			}

			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("flattenAnalyticsPayload() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestFlattenObject(t *testing.T) {
	tests := []struct {
		name      string
		obj       map[string]interface{}
		prefix    string
		parentKey string
		expected  map[string]interface{}
	}{
		{
			name: "simple object",
			obj: map[string]interface{}{
				"key1": "value1",
				"key2": 123,
				"key3": true,
			},
			prefix:    "prefix",
			parentKey: "",
			expected: map[string]interface{}{
				"prefix::key1": "value1",
				"prefix::key2": 123,
				"prefix::key3": true,
			},
		},
		{
			name: "excluded nil fields",
			obj: map[string]interface{}{
				"key1": "value1",
				"key2": 123,
				"key3": true,
				"key4": nil,
			},
			prefix:    "prefix",
			parentKey: "",
			expected: map[string]interface{}{
				"prefix::key1": "value1",
				"prefix::key2": 123,
				"prefix::key3": true,
			},
		},
		{
			name: "nested object",
			obj: map[string]interface{}{
				"key1": "value1",
				"nested": map[string]interface{}{
					"subkey1": "subvalue1",
				},
			},
			prefix:    "prefix",
			parentKey: "",
			expected: map[string]interface{}{
				"prefix::key1":            "value1",
				"prefix::nested__subkey1": "subvalue1",
			},
		},
		{
			name: "with parent key",
			obj: map[string]interface{}{
				"key1": "value1",
			},
			prefix:    "prefix",
			parentKey: "parent",
			expected: map[string]interface{}{
				"prefix::parent__key1": "value1",
			},
		},
		{
			name: "with array",
			obj: map[string]interface{}{
				"array": []interface{}{"one", "two"},
			},
			prefix:    "prefix",
			parentKey: "",
			expected: map[string]interface{}{
				"prefix::array": "[one two]",
			},
		},
	}

	interceptor := v1AnalyticsInterceptor{}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := make(map[string]interface{})
			interceptor.flattenObject(result, tt.obj, tt.prefix, tt.parentKey)

			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("flattenObject() = %v, want %v", result, tt.expected)
			}
		})
	}
}
