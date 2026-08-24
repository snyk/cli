package main

import "testing"

func TestEntrySource(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		data metadata
		want string
	}{
		{
			name: "prefers source",
			data: metadata{Source: "homebrew", BaseURL: "static.snyk.io"},
			want: "homebrew",
		},
		{
			name: "falls back to base_url",
			data: metadata{BaseURL: "downloads.snyk.io"},
			want: "downloads.snyk.io",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := entrySource(tt.data); got != tt.want {
				t.Fatalf("entrySource() = %q, want %q", got, tt.want)
			}
		})
	}
}
