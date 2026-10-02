package netutil

import "testing"

func TestDeviceHTTPClientRejectsRestrictedTargets(t *testing.T) {
	for _, target := range []string{"file:///etc/passwd", "http://127.0.0.1:8080/", "http://[::1]/", "http://169.254.1.1/"} {
		if _, err := NewDeviceHTTPClient(target, "", "", 10); err == nil {
			t.Fatalf("restricted target %q was accepted", target)
		}
	}
}

func TestDeriveDevicePasswordUsesMasterSecret(t *testing.T) {
	first, err := DeriveDevicePassword("SERIAL-1", "0123456789abcdef0123456789abcdef")
	if err != nil {
		t.Fatal(err)
	}
	second, err := DeriveDevicePassword("SERIAL-1", "fedcba9876543210fedcba9876543210")
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("different master secrets produced the same device password")
	}
	if _, err := DeriveDevicePassword("SERIAL-1", "weak"); err == nil {
		t.Fatal("weak derivation secret was accepted")
	}
}

func TestDeviceHTTPClientHonorsDestinationAllowlist(t *testing.T) {
	t.Setenv("CONNECTION_REQUEST_ALLOWED_CIDRS", "198.51.100.0/24")
	if _, err := NewDeviceHTTPClient("http://192.0.2.10:7547/", "", "", 10); err == nil {
		t.Fatal("destination outside configured allowlist was accepted")
	}
	if _, err := NewDeviceHTTPClient("http://198.51.100.10:7547/", "", "", 10); err != nil {
		t.Fatalf("allowlisted destination rejected: %v", err)
	}
}

func TestResolveConnCredentialsInheritGlobalCustom(t *testing.T) {
	username, password, err := ResolveConnCredentials("SN-1", "", "", "", "globalUser", "globalPass", false)
	if err != nil {
		t.Fatal(err)
	}
	if username != "globalUser" || password != "globalPass" {
		t.Fatalf("expected global credentials, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsInheritGlobalAuto(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	expected, _ := DeriveDevicePassword("SN-1", secret)
	username, password, err := ResolveConnCredentials("SN-1", "", "", "", "globalUser", secret, true)
	if err != nil {
		t.Fatal(err)
	}
	if username != "SN-1" || password != expected {
		t.Fatalf("expected derived credentials, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsPerDeviceAuto(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	expected, _ := DeriveDevicePassword("SN-2", secret)
	username, password, err := ResolveConnCredentials("SN-2", "auto", "", "", "globalUser", secret, false)
	if err != nil {
		t.Fatal(err)
	}
	if username != "SN-2" || password != expected {
		t.Fatalf("expected per-device auto credentials, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsPerDeviceCustom(t *testing.T) {
	username, password, err := ResolveConnCredentials("SN-3", "custom", "devUser", "devPass", "globalUser", "globalPass", false)
	if err != nil {
		t.Fatal(err)
	}
	if username != "devUser" || password != "devPass" {
		t.Fatalf("expected custom credentials, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsPerDeviceAutoOverridesGlobalCustom(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	expected, _ := DeriveDevicePassword("SN-4", secret)
	// Per-device "auto" should override global custom mode
	username, password, err := ResolveConnCredentials("SN-4", "auto", "", "", "globalUser", secret, false)
	if err != nil {
		t.Fatal(err)
	}
	if username != "SN-4" || password != expected {
		t.Fatalf("expected per-device auto to override global, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsInheritExplicit(t *testing.T) {
	username, password, err := ResolveConnCredentials("SN-5", "inherit", "", "", "globalUser", "globalPass", false)
	if err != nil {
		t.Fatal(err)
	}
	if username != "globalUser" || password != "globalPass" {
		t.Fatalf("expected global credentials for inherit mode, got %q/%q", username, password)
	}
}

func TestResolveConnCredentialsAutoRequiresValidSecret(t *testing.T) {
	if _, _, err := ResolveConnCredentials("SN-6", "auto", "", "", "", "weak", false); err == nil {
		t.Fatal("expected error for weak master secret in auto mode")
	}
}
