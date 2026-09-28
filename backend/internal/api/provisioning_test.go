package api

import (
	"reflect"
	"testing"
)

func TestNormalizeTags(t *testing.T) {
	cases := []struct {
		name string
		in   []string
		want []string
	}{
		{name: "trims and lowercases", in: []string{"  Branch-A ", "PREMIUM"}, want: []string{"branch-a", "premium"}},
		{name: "drops empty and whitespace-only", in: []string{"", "   ", "ok"}, want: []string{"ok"}},
		{name: "deduplicates case-insensitively", in: []string{"a", "A", "a "}, want: []string{"a"}},
		{name: "empty input", in: []string{}, want: []string{}},
		{name: "nil input", in: nil, want: []string{}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizeTags(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("normalizeTags(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestValidateProvisioningRuleTag(t *testing.T) {
	base := func(tag string) error {
		return validateProvisioningRule("InternetGatewayDevice.ManagementServer.URL", "http://acs.example.com", "string", "bootstrap", "", "", tag, "")
	}

	if err := base(""); err != nil {
		t.Fatalf("empty tag should be valid (applies to all devices), got %v", err)
	}
	if err := base("branch-a"); err != nil {
		t.Fatalf("valid tag was rejected: %v", err)
	}
	if err := base(string(make([]byte, 129))); err == nil {
		t.Fatal("tag over 128 characters should be rejected")
	}
}
