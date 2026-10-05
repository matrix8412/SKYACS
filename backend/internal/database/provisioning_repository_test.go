package database

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/skydashnet/skyacs/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// openTestDB connects to a real PostgreSQL instance for integration tests.
// It skips the test when no DSN is configured so the suite still passes in
// environments without a database (e.g. the unit-test CI job).
func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set; skipping PostgreSQL integration test")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("connect to test database: %v", err)
	}
	if err := db.AutoMigrate(&models.Device{}, &models.ProvisioningRule{}, &models.ProvisioningApplication{}); err != nil {
		t.Fatalf("auto-migrate test schema: %v", err)
	}
	return db
}

// TestListPendingForDeviceTagFilter verifies the jsonb tag-containment filter:
// a rule with a tag applies only to devices carrying that tag, while a rule
// with an empty tag applies to every device.
func TestListPendingForDeviceTagFilter(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	provRepo := NewProvisioningRepository(db)

	serial := fmt.Sprintf("test-tag-%d", time.Now().UnixNano())
	device := &models.Device{SerialNumber: serial, OUI: "00:00:00", Tags: []string{"branch-a", "hq"}}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}

	matching := &models.ProvisioningRule{ParameterName: "Device.WiFi.SSID.1.SSID", ParameterValue: "match", ParameterType: "string", Phase: "bootstrap", Tag: "branch-a", Enabled: true}
	nonMatching := &models.ProvisioningRule{ParameterName: "Device.WiFi.SSID.2.SSID", ParameterValue: "nope", ParameterType: "string", Phase: "bootstrap", Tag: "other", Enabled: true}
	unscoped := &models.ProvisioningRule{ParameterName: "Device.WiFi.SSID.3.SSID", ParameterValue: "all", ParameterType: "string", Phase: "bootstrap", Tag: "", Enabled: true}
	for _, rule := range []*models.ProvisioningRule{matching, nonMatching, unscoped} {
		if err := provRepo.Create(ctx, rule); err != nil {
			t.Fatalf("create rule: %v", err)
		}
	}
	t.Cleanup(func() {
		_ = db.Where("device_id = ?", device.ID).Delete(&models.ProvisioningApplication{})
		_ = db.Delete(&models.ProvisioningRule{}, []int64{matching.ID, nonMatching.ID, unscoped.ID})
		_ = db.Delete(&models.Device{}, device.ID)
	})

	assertPending := func(deviceID int64, want map[string]bool) {
		t.Helper()
		rules, err := provRepo.ListPendingForDevice(ctx, deviceID, "", "", "bootstrap")
		if err != nil {
			t.Fatalf("ListPendingForDevice: %v", err)
		}
		got := map[string]bool{}
		for _, r := range rules {
			got[r.ParameterName] = true
		}
		for name, expected := range want {
			if got[name] != expected {
				t.Errorf("rule %q pending=%v, want %v (full set: %v)", name, got[name], expected, got)
			}
		}
	}

	// Tagged device: matching-tag and unscoped rules apply; other-tag rule does not.
	assertPending(device.ID, map[string]bool{
		"Device.WiFi.SSID.1.SSID": true,
		"Device.WiFi.SSID.2.SSID": false,
		"Device.WiFi.SSID.3.SSID": true,
	})

	// Untagged device: tag-scoped rules must not apply; unscoped rules still do.
	untagged := &models.Device{SerialNumber: fmt.Sprintf("test-tag-none-%d", time.Now().UnixNano()), OUI: "00:00:01"}
	if err := db.Create(untagged).Error; err != nil {
		t.Fatalf("create untagged device: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Where("device_id = ?", untagged.ID).Delete(&models.ProvisioningApplication{})
		_ = db.Delete(&models.Device{}, untagged.ID)
	})
	assertPending(untagged.ID, map[string]bool{
		"Device.WiFi.SSID.1.SSID": false,
		"Device.WiFi.SSID.2.SSID": false,
		"Device.WiFi.SSID.3.SSID": true,
	})
}

// TestUpdateProductClasses verifies that the Update method correctly serializes
// the ProductClasses []string field to jsonb when using a map-based GORM update.
func TestUpdateProductClasses(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	provRepo := NewProvisioningRepository(db)

	serial := fmt.Sprintf("test-pc-%d", time.Now().UnixNano())
	device := &models.Device{SerialNumber: serial, OUI: "00:00:02"}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}

	// Create a rule with initial product classes.
	initial := []string{"class-a", "class-b"}
	rule := &models.ProvisioningRule{
		ParameterName:  "Test.Update.PC",
		ParameterValue: "initial",
		ParameterType:  "string",
		Phase:          "bootstrap",
		ProductClasses: initial,
		Enabled:        true,
		Order:          0,
	}
	if err := provRepo.Create(ctx, rule); err != nil {
		t.Fatalf("create rule: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Delete(&models.ProvisioningRule{}, rule.ID)
		_ = db.Delete(&models.Device{}, device.ID)
	})

	// Verify initial state.
	var loaded models.ProvisioningRule
	if err := db.First(&loaded, rule.ID).Error; err != nil {
		t.Fatalf("load rule: %v", err)
	}
	if len(loaded.ProductClasses) != 2 || loaded.ProductClasses[0] != "class-a" || loaded.ProductClasses[1] != "class-b" {
		t.Fatalf("initial ProductClasses = %v, want %v", loaded.ProductClasses, initial)
	}

	// Update with new product classes.
	updated := []string{"class-c", "class-d", "class-e"}
	rule.ParameterValue = "updated"
	rule.ProductClasses = updated
	if err := provRepo.Update(ctx, rule); err != nil {
		t.Fatalf("update rule: %v", err)
	}

	// Verify the update persisted correctly.
	if err := db.First(&loaded, rule.ID).Error; err != nil {
		t.Fatalf("reload rule: %v", err)
	}
	if len(loaded.ProductClasses) != 3 {
		t.Fatalf("updated ProductClasses len = %d, want 3 (got %v)", len(loaded.ProductClasses), loaded.ProductClasses)
	}
	for i, want := range updated {
		if loaded.ProductClasses[i] != want {
			t.Errorf("ProductClasses[%d] = %q, want %q", i, loaded.ProductClasses[i], want)
		}
	}
	if loaded.ParameterValue != "updated" {
		t.Errorf("ParameterValue = %q, want %q", loaded.ParameterValue, "updated")
	}

	// Update to nil (clear product classes).
	rule.ProductClasses = nil
	if err := provRepo.Update(ctx, rule); err != nil {
		t.Fatalf("update rule to nil: %v", err)
	}
	if err := db.First(&loaded, rule.ID).Error; err != nil {
		t.Fatalf("reload rule after nil: %v", err)
	}
	if loaded.ProductClasses != nil {
		t.Errorf("ProductClasses after nil update = %v, want nil", loaded.ProductClasses)
	}
}

// TestMaxOrder verifies that MaxOrder returns the highest order value for a
// given phase and 0 when no rules exist for that phase.
func TestMaxOrder(t *testing.T) {
	db := openTestDB(t)
	ctx := context.Background()

	provRepo := NewProvisioningRepository(db)

	// Use a unique phase to avoid interference with other tests.
	phase := fmt.Sprintf("test-max-order-%d", time.Now().UnixNano())

	// No rules yet: MaxOrder should return 0.
	max, err := provRepo.MaxOrder(ctx, phase)
	if err != nil {
		t.Fatalf("MaxOrder (empty): %v", err)
	}
	if max != 0 {
		t.Fatalf("MaxOrder (empty) = %d, want 0", max)
	}

	// Create rules with orders 0, 1, 2.
	ids := make([]int64, 3)
	for i := 0; i < 3; i++ {
		rule := &models.ProvisioningRule{
			ParameterName:  fmt.Sprintf("Test.Param.%d", i),
			ParameterValue: "val",
			ParameterType:  "string",
			Phase:          phase,
			Enabled:        true,
			Order:          i,
		}
		if err := provRepo.Create(ctx, rule); err != nil {
			t.Fatalf("create rule %d: %v", i, err)
		}
		ids[i] = rule.ID
	}
	t.Cleanup(func() {
		_ = db.Delete(&models.ProvisioningRule{}, ids)
	})

	max, err = provRepo.MaxOrder(ctx, phase)
	if err != nil {
		t.Fatalf("MaxOrder: %v", err)
	}
	if max != 2 {
		t.Fatalf("MaxOrder = %d, want 2", max)
	}

	// A different phase should still return 0.
	otherPhase := phase + "-other"
	max, err = provRepo.MaxOrder(ctx, otherPhase)
	if err != nil {
		t.Fatalf("MaxOrder (other phase): %v", err)
	}
	if max != 0 {
		t.Fatalf("MaxOrder (other phase) = %d, want 0", max)
	}
}
