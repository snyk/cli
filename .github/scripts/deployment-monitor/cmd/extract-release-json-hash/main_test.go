package main

import "testing"

func TestExtractHash(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		sha256  string
		want    string
		wantErr bool
	}{
		{
			name:   "plain hash",
			sha256: "abc123",
			want:   "abc123",
		},
		{
			name:   "hash with trailing comment",
			sha256: "abc123  snyk-macos",
			want:   "abc123",
		},
		{
			name:    "whitespace only",
			sha256:  "   ",
			wantErr: true,
		},
		{
			name:    "empty",
			sha256:  "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := extractHash(tt.sha256)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("extractHash() expected error, got %q", got)
				}
				return
			}
			if err != nil {
				t.Fatalf("extractHash() unexpected error: %v", err)
			}
			if got != tt.want {
				t.Fatalf("extractHash() = %q, want %q", got, tt.want)
			}
		})
	}
}
