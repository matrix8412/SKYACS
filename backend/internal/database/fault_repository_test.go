package database

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/skydashnet/skyacs/internal/models"
)

// TestListPopulatesSerialNumber verifies that List and GetByDeviceID populate
// the denormalized SerialNumber field from the devices join (regression test
// for the gorm:"-" tag that prevented Scan from mapping d.serial_number).
func TestListPopulatesSerialNumber(t *testing.T) {
	db := openTestDB(t)
	if err := db.AutoMigrate(&models.Fault{}); err != nil {
		t.Fatalf("auto-migrate faults: %v", err)
	}
	ctx := context.Background()

	faultRepo := NewFaultRepository(db)

	serial := fmt.Sprintf("test-fault-%d", time.Now().UnixNano())
	device := &models.Device{SerialNumber: serial, OUI: "00:00:02"}
	if err := db.Create(device).Error; err != nil {
		t.Fatalf("create device: %v", err)
	}

	fault := &models.Fault{DeviceID: device.ID, FaultCode: "9005", FaultString: "Invalid parameter name"}
	if err := faultRepo.Create(ctx, fault); err != nil {
		t.Fatalf("create fault: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Delete(&models.Fault{}, fault.ID)
		_ = db.Delete(&models.Device{}, device.ID)
	})

	// List must return the device serial via the join.
	listed, total, err := faultRepo.List(ctx, 50, 0, nil)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total == 0 {
		t.Fatal("List returned no faults")
	}
	found := false
	for _, f := range listed {
		if f.ID == fault.ID {
			found = true
			if f.SerialNumber != serial {
				t.Errorf("List: serial_number = %q, want %q", f.SerialNumber, serial)
			}
		}
	}
	if !found {
		t.Fatal("List did not return the created fault")
	}

	// GetByDeviceID must return the device serial via the join.
	byDevice, err := faultRepo.GetByDeviceID(ctx, device.ID)
	if err != nil {
		t.Fatalf("GetByDeviceID: %v", err)
	}
	if len(byDevice) != 1 {
		t.Fatalf("GetByDeviceID returned %d faults, want 1", len(byDevice))
	}
	if byDevice[0].SerialNumber != serial {
		t.Errorf("GetByDeviceID: serial_number = %q, want %q", byDevice[0].SerialNumber, serial)
	}
}
