package featureflaggateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

const (
	// ApplicationJSON is the content type for JSON.
	ApplicationJSON = "application/json"
	userAgent       = "User-Agent"
	contentType     = "Content-Type"
	accept          = "Accept"
	snykCli         = "snyk-cli"
	authorization   = "Authorization"
	defaultVersion  = "2024-10-15"
)

// Service is a service for interacting with Feature Flag Gateway.
type Service interface {
	EvaluateFlags(ctx context.Context, flags []string, orgID string, version string, token string) (*FeatureFlagsResponse, error)
}

// Client is an HTTP client for the Feature Flag Gateway
// endpoint.
type Client struct {
	baseURL *url.URL
	client  *http.Client
}

// NewService creates a new Feature Flag Gateway client.
func NewService(baseURL *url.URL, requestTimeout time.Duration) (*Client, error) {
	if baseURL == nil {
		return nil, fmt.Errorf("base URL is nil")
	}

	client := &http.Client{
		Timeout: requestTimeout,
	}

	return &Client{
		baseURL: baseURL,
		client:  client,
	}, nil
}

// EvaluateFlags evaluates feature flags for a given organization.
func (c *Client) EvaluateFlags(ctx context.Context, flags []string, orgID string, version string, token string) (featureFlagsResponse *FeatureFlagsResponse, retErr error) {
	orgID = strings.TrimSpace(orgID)
	if orgID == "" {
		return nil, fmt.Errorf("orgID is required")
	}

	token = strings.TrimSpace(token)
	if token == "" {
		return nil, fmt.Errorf("token is required")
	}

	if version == "" {
		version = defaultVersion
	}

	reqBody := buildRequest(flags)
	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return featureFlagsResponse, fmt.Errorf("marshal evaluate flags request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.getBaseURL(orgID, version), bytes.NewReader(bodyBytes))
	if err != nil {
		return featureFlagsResponse, fmt.Errorf("create evaluate flagsrequest: %w", err)
	}

	req.Header.Add(contentType, ApplicationJSON)
	req.Header.Add(accept, ApplicationJSON)
	req.Header.Add(userAgent, snykCli)
	req.Header.Set(authorization, "token "+token)

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("making evaluate flags request: %w", err)
	}
	defer func() {
		retErr = errors.Join(retErr, resp.Body.Close())
	}()

	if resp.StatusCode != http.StatusOK {
		err = fmt.Errorf("evaluate flags failed: status=%d", resp.StatusCode)
		return nil, err
	}

	if err := json.NewDecoder(resp.Body).Decode(&featureFlagsResponse); err != nil {
		return nil, fmt.Errorf("decode evaluate flags response: %w", err)
	}

	return featureFlagsResponse, nil
}

func buildRequest(flags []string) FeatureFlagRequest {
	return FeatureFlagRequest{
		Data: FeatureFlagsData{
			Type: "feature_flags_evaluation",
			Attributes: FeatureFlagsRequestAttributes{
				Flags: flags,
			},
		},
	}
}

func (c *Client) getBaseURL(orgID, version string) string {
	if version == "" {
		version = defaultVersion
	}

	u := *c.baseURL
	u.Path = path.Join(
		u.Path,
		"orgs",
		url.PathEscape(orgID),
		"feature_flags",
		"evaluation",
	)

	q := u.Query()
	q.Set("version", version)
	u.RawQuery = q.Encode()

	return u.String()
}
