package interceptor

import (
	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"net/http"
	"net/url"
	"testing"
)

func TestV1AnalyticsInterceptor(t *testing.T) {
	ctrl := gomock.NewController(t)
	defer ctrl.Finish()

	t.Run("URL condition matching", func(t *testing.T) {
		logger := zerolog.Nop()

		mockInvocationCtx := mocks.NewMockInvocationContext(ctrl)

		tests := []struct {
			name        string
			url         string
			interceptor Interceptor
			expected    bool
		}{
			{
				name:        "matches v1 analytics endpoint",
				url:         "https://api.snyk.io/v1/analytics/cli",
				interceptor: NewV1AnalyticsInterceptor(mockInvocationCtx, &logger),
				expected:    true,
			},
			{
				name:        "doesn't match non-analytics endpoints",
				url:         "https://api.snyk.io/v1/test",
				interceptor: NewV1AnalyticsInterceptor(mockInvocationCtx, &logger),
				expected:    false,
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				parsedURL, err := url.Parse(tt.url)
				if err != nil {
					t.Fatalf("Failed to parse URL: %v", err)
				}
				req := &http.Request{
					URL: parsedURL,
				}

				result := tt.interceptor.GetCondition().HandleReq(req, nil)

				if result != tt.expected {
					t.Errorf("Condition match = %v, expected %v for URL %s", result, tt.expected, tt.url)
				}
			})
		}
	})
}
