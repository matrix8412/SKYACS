package models

import (
	"time"
)

// MetricDefinition describes a single metric that can be collected from devices.
// DeviceTypeMatch is a glob pattern matched against "Manufacturer/ProductClass".
// Source controls how the metric is collected:
//   - "passive": extracted from Inform parameter lists
//   - "active":  fetched via GetParameterValues on a polling interval
//   - "universal": collected from both sources
type MetricDefinition struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	Name            string    `json:"name" gorm:"uniqueIndex;not null"`
	Description     string    `json:"description"`
	DeviceTypeMatch string    `json:"device_type_match" gorm:"not null;default:'*'"`
	ParameterName   string    `json:"parameter_name" gorm:"not null"`
	Unit            string    `json:"unit"`
	Source          string    `json:"source" gorm:"not null;default:'passive'"`
	Active          bool      `json:"active" gorm:"default:true"`
	Group           string    `json:"group" gorm:"default:''"`
	Color           string    `json:"color" gorm:"default:''"`
	Axis            string    `json:"axis" gorm:"default:'left'"`
	Transform       string    `json:"transform" gorm:"default:''"`
	Multiplier      float64   `json:"multiplier" gorm:"default:1"`
	UnitScale       string    `json:"unit_scale" gorm:"default:''"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

func (MetricDefinition) TableName() string {
	return "metric_definitions"
}

// MetricSample is a single time-series data point stored in a TimescaleDB hypertable.
// The composite primary key (device_id, metric_id, timestamp) satisfies the
// TimescaleDB requirement that the PK includes the time column.
type MetricSample struct {
	DeviceID  int64     `json:"device_id" gorm:"primaryKey"`
	MetricID  int64     `json:"metric_id" gorm:"primaryKey"`
	Value     float64   `json:"value" gorm:"not null"`
	Timestamp time.Time `json:"timestamp" gorm:"primaryKey"`
}

func (MetricSample) TableName() string {
	return "metric_samples"
}

// AggregatedMetric is a row returned from a continuous aggregate query.
type AggregatedMetric struct {
	Timestamp time.Time `json:"timestamp"`
	Avg       float64   `json:"avg"`
	Min       float64   `json:"min"`
	Max       float64   `json:"max"`
	Count     int64     `json:"count"`
}
