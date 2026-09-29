package models

import "time"

type ProvisioningRule struct {
	ID             int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	ParameterName  string    `json:"parameter_name" gorm:"not null"`
	ParameterValue string    `json:"parameter_value"`
	ParameterType  string    `json:"parameter_type" gorm:"default:'string'"`
	Phase          string    `json:"phase" gorm:"size:16;default:'bootstrap'"`
	Manufacturer   string    `json:"manufacturer,omitempty" gorm:"size:128"`
	ProductClass   string    `json:"product_class,omitempty" gorm:"size:128"`
	Tag            string    `json:"tag,omitempty" gorm:"column:tag;size:128;not null;default:''"`
	Enabled        bool      `json:"enabled" gorm:"default:true"`
	Version        uint64    `json:"version" gorm:"not null;default:1"`
	Description    string    `json:"description,omitempty"`
	AddObjectPath  string    `json:"add_object_path,omitempty" gorm:"size:512"`
	Order          int       `json:"order" gorm:"not null;default:0"`
	CreatedAt      time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt      time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

func (ProvisioningRule) TableName() string {
	return "provisioning_rules"
}

type CreateProvisioningRuleRequest struct {
	ParameterName  string `json:"parameter_name"`
	ParameterValue string `json:"parameter_value"`
	ParameterType  string `json:"parameter_type"`
	Phase          string `json:"phase"`
	Manufacturer   string `json:"manufacturer"`
	ProductClass   string `json:"product_class"`
	Tag            string `json:"tag"`
	Enabled        bool   `json:"enabled"`
	Description    string `json:"description"`
	AddObjectPath  string `json:"add_object_path"`
	Order          int    `json:"order"`
}

type ProvisioningApplication struct {
	ID          int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	DeviceID    int64     `json:"device_id" gorm:"uniqueIndex:idx_provisioning_application_v2,priority:1;not null"`
	RuleID      int64     `json:"rule_id" gorm:"uniqueIndex:idx_provisioning_application_v2,priority:2;not null"`
	RuleVersion uint64    `json:"rule_version" gorm:"uniqueIndex:idx_provisioning_application_v2,priority:3;not null;default:1"`
	AppliedAt   time.Time `json:"applied_at" gorm:"autoCreateTime"`
}

func (ProvisioningApplication) TableName() string { return "provisioning_applications" }
