package hlc

import (
	"strings"
	"testing"
)

func TestString(t *testing.T) {
	h := &HLC{PhysicalTime: 0, LogicalTime: 0, ClientID: "abc"}
	if got, want := h.String(), "000000000000000-00000-abc"; got != want {
		t.Fatalf("String() = %q, want %q", got, want)
	}
	h2 := &HLC{PhysicalTime: 123456789012345, LogicalTime: 35, ClientID: "xyz"}
	// 35 in base36 is "z", padded to 5 → "0000z"
	if got, want := h2.String(), "123456789012345-0000z-xyz"; got != want {
		t.Fatalf("String() = %q, want %q", got, want)
	}
}

func TestFromStringRoundTrip(t *testing.T) {
	for _, s := range []string{
		"000000000000000-00000-abc",
		"123456789012345-0000z-xyz",
		"000000000000001-0000a-client_id_with_dashes-a-b",
	} {
		parsed, err := FromString(s)
		if err != nil {
			t.Fatalf("FromString(%q): %v", s, err)
		}
		if parsed.String() != s {
			t.Fatalf("round trip %q → %q", s, parsed.String())
		}
	}
}

func TestFromStringMalformed(t *testing.T) {
	cases := []string{
		"",
		"no-dashes",
		"-",
		"1-2",
		"abc-def", // only one dash
		"x-y-z",   // non-numeric physical time
		"1-!-abc", // invalid base36 logical time
		"-00000-abc",
		"1--abc",
	}
	for _, s := range cases {
		if _, err := FromString(s); err == nil {
			t.Fatalf("expected error for %q", s)
		}
	}
}

func TestGenerate(t *testing.T) {
	a, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	if a.ClientID == "" {
		t.Fatal("empty client ID")
	}
	b, err := Generate()
	if err != nil {
		t.Fatal(err)
	}
	if b.ClientID == "" {
		t.Fatal("empty client ID")
	}
	if a.ClientID == b.ClientID {
		t.Fatal("expected distinct client IDs")
	}
	if len(a.ClientID) != clientIDLength {
		t.Fatalf("client ID length = %d, want %d", len(a.ClientID), clientIDLength)
	}
	for _, c := range a.ClientID {
		if !strings.ContainsRune(Alphabet, c) {
			t.Fatalf("client ID contains char %q outside alphabet", c)
		}
	}
	parsed, err := FromString(a.String())
	if err != nil {
		t.Fatalf("round trip: %v", err)
	}
	if parsed.ClientID != a.ClientID {
		t.Fatalf("client ID mismatch: %q vs %q", parsed.ClientID, a.ClientID)
	}
}
