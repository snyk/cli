package basic_workflows

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"runtime"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/networking"

	"github.com/snyk/cli/cliv2/internal/proxy"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_finalizeArguments(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_doubleDashNotAppend(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "x"}
	actual := finalizeArguments([]string{"a", "b", "c", "--", "x"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

func Test_finalizeArguments_(t *testing.T) {
	expected := []string{"a", "b", "c", "--", "d", "e", "f"}
	actual := finalizeArguments([]string{"a", "b", "--proxy-noauth", "c"}, []string{"d", "e", "f"})
	assert.Equal(t, expected, actual)
}

// Test_proxyWithErrorHandler tests if we correctly either set or do not set the "snyk-terminate" header,
// which is a signal to the legacy TypeScript CLI that it should stop trying to send HTTP requests.
func Test_proxyWithErrorHandler(t *testing.T) {
	ctrl := gomock.NewController(t)
	logger := zerolog.Nop()
	config := configuration.NewWithOpts()

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	})
	server := httptest.NewServer(handler)
	defer server.Close()

	networkAccess := networking.NewNetworkAccess(config)
	networkAccess.AddErrorHandler(func(err error, _ context.Context) error { return err })

	invocationCtxMock := mocks.NewMockInvocationContext(ctrl)
	invocationCtxMock.EXPECT().GetNetworkAccess().Return(networkAccess).AnyTimes()
	invocationCtxMock.EXPECT().GetEnhancedLogger().Return(&logger).AnyTimes()

	testCases := []struct {
		name              string
		configureApiUrl   string
		expectedIntercept bool
	}{
		{
			name:              "intercepts traffic based on configuration",
			configureApiUrl:   server.URL,
			expectedIntercept: true,
		},
		{
			name:              "does not intercept external traffic",
			configureApiUrl:   "http://api.snyk.io",
			expectedIntercept: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			config.Set(configuration.API_URL, tc.configureApiUrl)
			wp, err := createInternalProxy(config, &logger, invocationCtxMock)
			assert.Nil(t, err)

			defer wp.Close()

			client := http.Client{Transport: &http.Transport{Proxy: func(*http.Request) (*url.URL, error) {
				return &url.URL{Scheme: "http", Host: fmt.Sprintf("127.0.0.1:%d", wp.ProxyInfo().Port)}, nil
			}}}

			res, err := client.Get(server.URL)
			assert.NotNil(t, res)
			defer func() { _ = res.Body.Close() }()

			assert.Equal(t, tc.expectedIntercept, res.Header.Get(proxy.HeaderSnykTerminate) == "true")
			assert.Nil(t, err)
		})
	}
}

func Test_ValidateGlibcVersion_doesNotApplyOnNonLinux(t *testing.T) {
	// skip for Linux
	if runtime.GOOS == "linux" {
		t.Skip("Test only applicable on non-Linux")
	}

	logger := zerolog.Nop()
	err := ValidateGlibcVersion(&logger, "", "darwin", "amd64", false)
	assert.NoError(t, err)
}

func Test_ValidateGlibcVersion_validation(t *testing.T) {
	t.Parallel()

	logger := zerolog.Nop()

	type glibcTest struct {
		name                string
		version             string
		os                  string
		arch                string
		expectedSnykErrCode string
		staticNodeJsBinary  bool
	}

	t.Run("validates successfully", func(t *testing.T) {
		t.Parallel()

		tests := []glibcTest{
			{
				name:               "version exactly minimum on amd64",
				version:            MIN_GLIBC_VERSION_LINUX_AMD64,
				os:                 "linux",
				arch:               "amd64",
				staticNodeJsBinary: false,
			},
			{
				name:               "version newer than minimum on amd64",
				version:            "2.35",
				os:                 "linux",
				arch:               "amd64",
				staticNodeJsBinary: false,
			},
			{
				name:               "version exactly minimum on arm64",
				version:            MIN_GLIBC_VERSION_LINUX_ARM64,
				os:                 "linux",
				arch:               "arm64",
				staticNodeJsBinary: false,
			},
			{
				name:               "version newer than minimum on arm64",
				version:            "2.35",
				os:                 "linux",
				arch:               "arm64",
				staticNodeJsBinary: false,
			},
			{
				name:               "invalid version format",
				version:            "glibc version", // not a valid semver string
				os:                 "linux",
				arch:               "amd64",
				staticNodeJsBinary: false,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				actualErr := ValidateGlibcVersion(&logger, tt.version, tt.os, tt.arch, tt.staticNodeJsBinary)

				assert.NoError(t, actualErr)
			})
		}
	})

	t.Run("returns error", func(t *testing.T) {
		t.Parallel()

		testCases := []glibcTest{
			{
				name:                "version too old on amd64",
				version:             "2.27", // below minimum of 2.28
				os:                  "linux",
				arch:                "amd64",
				expectedSnykErrCode: "SNYK-0010",
				staticNodeJsBinary:  false,
			},
			{
				name:                "version too old on arm64",
				version:             "2.30", // below minimum of 2.31
				os:                  "linux",
				arch:                "arm64",
				expectedSnykErrCode: "SNYK-0010",
				staticNodeJsBinary:  false,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				actualErr := ValidateGlibcVersion(&logger, tc.version, tc.os, tc.arch, tc.staticNodeJsBinary)
				require.NotNil(t, actualErr, "Expected error but got nil")
				var snykErr snyk_errors.Error
				require.True(t, errors.As(actualErr, &snykErr), "Expected snyk_errors.Error but got: %v", actualErr)
				assert.Equal(t, tc.expectedSnykErrCode, snykErr.ErrorCode)
			})
		}
	})

	t.Run("returns nil", func(t *testing.T) {
		t.Parallel()

		testCases := []glibcTest{
			{
				name:               "invalid os",
				version:            "1.0.0",
				os:                 "windows",
				arch:               "amd64",
				staticNodeJsBinary: false,
			},
			{
				name:               "invalid arch",
				version:            "1.0.0",
				os:                 "linux",
				arch:               "riscv",
				staticNodeJsBinary: false,
			},
			{
				name:               "musl/Alpine",
				version:            "",
				os:                 "linux",
				arch:               "amd64",
				staticNodeJsBinary: false,
			},
			{
				name:               "linux static builds",
				version:            "1.0.0",
				os:                 "linux",
				arch:               "amd64",
				staticNodeJsBinary: true,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				actualErr := ValidateGlibcVersion(&logger, tc.version, tc.os, tc.arch, tc.staticNodeJsBinary)
				require.Nil(t, actualErr, "Expected no error but got: %v", actualErr)
			})
		}
	})
}
