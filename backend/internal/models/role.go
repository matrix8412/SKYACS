package models

import "time"

// Permission keys for granular access control.
const (
	PermUsersRead       = "users.read"
	PermUsersWrite      = "users.write"
	PermRolesRead       = "roles.read"
	PermRolesWrite      = "roles.write"
	PermDevicesRead     = "devices.read"
	PermDevicesWrite    = "devices.write"
	PermFirmwaresRead   = "firmwares.read"
	PermFirmwaresWrite  = "firmwares.write"
	PermFaultsRead      = "faults.read"
	PermFaultsWrite     = "faults.write"
	PermProvisioningRead  = "provisioning.read"
	PermProvisioningWrite = "provisioning.write"
	PermSettingsRead    = "settings.read"
	PermSettingsWrite   = "settings.write"
	PermMetricsRead     = "metrics.read"
	PermMetricsWrite    = "metrics.write"
	PermSecurityRead    = "security.read"
	PermSecurityWrite   = "security.write"
)

// AllPermissions lists every permission key.
var AllPermissions = []string{
	PermUsersRead, PermUsersWrite,
	PermRolesRead, PermRolesWrite,
	PermDevicesRead, PermDevicesWrite,
	PermFirmwaresRead, PermFirmwaresWrite,
	PermFaultsRead, PermFaultsWrite,
	PermProvisioningRead, PermProvisioningWrite,
	PermSettingsRead, PermSettingsWrite,
	PermMetricsRead, PermMetricsWrite,
	PermSecurityRead, PermSecurityWrite,
}

// ReadPermissions lists all read-only permission keys.
var ReadPermissions = []string{
	PermUsersRead,
	PermRolesRead,
	PermDevicesRead,
	PermFirmwaresRead,
	PermFaultsRead,
	PermProvisioningRead,
	PermSettingsRead,
	PermMetricsRead,
	PermSecurityRead,
}

// Role represents a named role with a set of permissions.
type Role struct {
	ID          int64    `gorm:"primaryKey" json:"id"`
	Name        string   `gorm:"uniqueIndex;size:64;not null" json:"name"`
	Description string   `gorm:"size:256" json:"description"`
	Permissions  []string `gorm:"type:jsonb;default:'[]'" json:"permissions"`
	IsSystem    bool     `gorm:"default:false" json:"is_system"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Role) TableName() string { return "roles" }

// CreateRoleRequest is the request body for creating a role.
type CreateRoleRequest struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

// UpdateRoleRequest is the request body for updating a role.
type UpdateRoleRequest struct {
	Name        *string  `json:"name"`
	Description *string  `json:"description"`
	Permissions []string `json:"permissions"`
}