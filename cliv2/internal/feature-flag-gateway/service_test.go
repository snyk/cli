package featureflaggateway

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"
)

func TestEvaluateFlags_Success(t *testing.T) {
	orgID := "org-123"
	flags := []string{"flag-a", "flag-b"}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("expected method POST, got %s", r.Method)
		}

		if !strings.HasSuffix(r.URL.Path, "/orgs/"+url.PathEscape(orgID)+"/feature_flags/evaluation") {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}

		var req FeatureFlagRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatalf("failed to decode request body: %v", err)
		}
		if len(req.Data.Attributes.Flags) != len(flags) {
			t.Fatalf("expected %d flags, got %d", len(flags), len(req.Data.Attributes.Flags))
		}

		w.Header().Set("Content-Type", ApplicationJSON)
		w.WriteHeader(http.StatusOK)
		resp := FeatureFlagsResponse{
			Data: FeatureFlagsDataItem{
				ID:   "some-id",
				Type: "feature_flags_evaluation",
				Attributes: FeatureFlagAttributesList{
					Evaluations: []FeatureFlagAttributes{
						{Key: "flag-a", Value: true, Reason: "default"},
						{Key: "flag-b", Value: false, Reason: "default"},
					},
					EvaluatedAt: "2024-10-15T00:00:00Z",
				},
			},
		}

		if err := json.NewEncoder(w).Encode(&resp); err != nil {
			t.Fatalf("failed to encode response: %v", err)
		}
	}))
	defer ts.Close()

	baseURL, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("failed to parse URL: %v", err)
	}
	svc, err := NewService(baseURL, 5*time.Second)
	if err != nil {
		t.Fatalf("NewService error: %v", err)
	}

	ctx := context.Background()
	got, err := svc.EvaluateFlags(ctx, flags, orgID, "", "token")
	if err != nil {
		t.Fatalf("EvaluateFlags returned error: %v", err)
	}

	if got == nil {
		t.Fatalf("expected non-nil response")
	}

	if got.Data.ID != "some-id" {
		t.Fatalf("expected Data.ID %q, got %q", "some-id", got.Data.ID)
	}

	if len(got.Data.Attributes.Evaluations) != 2 {
		t.Fatalf("expected 2 evaluations, got %d", len(got.Data.Attributes.Evaluations))
	}

	if got.Data.Attributes.Evaluations[0].Key != "flag-a" || !got.Data.Attributes.Evaluations[0].Value {
		t.Fatalf("unexpected first evaluation: %+v", got.Data.Attributes.Evaluations[0])
	}
}

func TestEvaluateFlags_EmptyOrgID(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("server should not have been called for empty orgID")
	}))
	defer ts.Close()

	baseURL, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("failed to parse URL: %v", err)
	}
	svc, err := NewService(baseURL, 5*time.Second)
	if err != nil {
		t.Fatalf("NewService error: %v", err)
	}

	ctx := context.Background()
	_, err = svc.EvaluateFlags(ctx, []string{"flag-a"}, "   ", "", "token")
	if err == nil {
		t.Fatalf("expected error for empty orgID, got nil")
	}

	if !strings.Contains(err.Error(), "orgID is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEvaluateFlags_EmptyToken(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("server should not have been called for empty token")
	}))
	defer ts.Close()

	baseURL, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("failed to parse URL: %v", err)
	}
	svc, err := NewService(baseURL, 5*time.Second)
	if err != nil {
		t.Fatalf("NewService error: %v", err)
	}

	ctx := context.Background()
	_, err = svc.EvaluateFlags(ctx, []string{"flag-a"}, "orgid", "", "")
	if err == nil {
		t.Fatalf("expected error for empty token, got nil")
	}

	if !strings.Contains(err.Error(), "token is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEvaluateFlags_Non200Status(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error": "something went wrong"}`))
	}))
	defer ts.Close()

	baseURL, err := url.Parse(ts.URL)
	if err != nil {
		t.Fatalf("failed to parse URL: %v", err)
	}
	svc, err := NewService(baseURL, 5*time.Second)
	if err != nil {
		t.Fatalf("NewService error: %v", err)
	}

	ctx := context.Background()
	_, err = svc.EvaluateFlags(ctx, []string{"flag-a"}, "org-123", "", "token")
	if err == nil {
		t.Fatalf("expected error for non-200 status, got nil")
	}

	if !strings.Contains(err.Error(), "status=500") {
		t.Fatalf("expected error to mention status=500, got: %v", err)
	}
}
