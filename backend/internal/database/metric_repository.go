package database

import (
	"context"
	"fmt"
	"log"
	"math"
	"path"
	"strconv"
	"time"

	"github.com/skydashnet/skyacs/internal/models"
	"gorm.io/gorm"
)

type MetricRepository struct {
	db *gorm.DB
}

func NewMetricRepository(db *gorm.DB) *MetricRepository {
	return &MetricRepository{db: db}
}

// ListActive returns all active metric definitions.
func (r *MetricRepository) ListActive(ctx context.Context) ([]models.MetricDefinition, error) {
	var defs []models.MetricDefinition
	err := r.db.WithContext(ctx).Where("active = ?", true).Order("name ASC").Find(&defs).Error
	return defs, err
}

// ListAll returns all metric definitions (for the settings UI).
func (r *MetricRepository) ListAll(ctx context.Context) ([]models.MetricDefinition, error) {
	var defs []models.MetricDefinition
	err := r.db.WithContext(ctx).Order("name ASC").Find(&defs).Error
	return defs, err
}

// Create inserts a new metric definition.
func (r *MetricRepository) Create(ctx context.Context, def *models.MetricDefinition) error {
	return r.db.WithContext(ctx).Create(def).Error
}

// Update modifies an existing metric definition.
func (r *MetricRepository) Update(ctx context.Context, def *models.MetricDefinition) error {
	return r.db.WithContext(ctx).Save(def).Error
}

// Delete removes a metric definition by ID.
func (r *MetricRepository) Delete(ctx context.Context, id int64) error {
	return r.db.WithContext(ctx).Delete(&models.MetricDefinition{}, id).Error
}

// BatchInsert inserts metric samples in batches of 500.
func (r *MetricRepository) BatchInsert(ctx context.Context, samples []models.MetricSample) error {
	if len(samples) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).CreateInBatches(&samples, 500).Error
}

// QueryRaw returns raw metric samples for a device within a time range.
func (r *MetricRepository) QueryRaw(ctx context.Context, deviceID, metricID int64, from, to time.Time) ([]models.MetricSample, error) {
	var samples []models.MetricSample
	err := r.db.WithContext(ctx).
		Where("device_id = ? AND metric_id = ? AND timestamp BETWEEN ? AND ?", deviceID, metricID, from, to).
		Order("timestamp ASC").
		Find(&samples).Error
	return samples, err
}

// ExtractAndStore matches parameters against active metric definitions for a device
// and stores any numeric values found. deviceType is "Manufacturer/ProductClass".
func (r *MetricRepository) ExtractAndStore(ctx context.Context, deviceID int64, deviceType string, paramMap map[string]string) error {
	defs, err := r.ListActive(ctx)
	if err != nil || len(defs) == 0 {
		return err
	}

	now := time.Now()
	var samples []models.MetricSample

	for _, def := range defs {
		if !deviceTypeMatches(deviceType, def.DeviceTypeMatch) {
			continue
		}
		value, ok := paramMap[def.ParameterName]
		if !ok || value == "" {
			continue
		}
		fv, err := strconv.ParseFloat(value, 64)
		if err != nil || math.IsNaN(fv) || math.IsInf(fv, 0) {
			continue
		}
		samples = append(samples, models.MetricSample{
			DeviceID:  deviceID,
			MetricID:  def.ID,
			Value:     fv,
			Timestamp: now,
		})
	}

	if len(samples) == 0 {
		return nil
	}
	if err := r.BatchInsert(ctx, samples); err != nil {
		return fmt.Errorf("batch insert metric samples: %w", err)
	}
	log.Printf("Stored %d metric samples for device %d", len(samples), deviceID)
	return nil
}

// ActiveParamNames returns the parameter names needed for active metric collection
// for a given device type.
func (r *MetricRepository) ActiveParamNames(ctx context.Context, deviceType string) ([]string, error) {
	defs, err := r.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool)
	var names []string
	for _, def := range defs {
		if def.Source != "active" && def.Source != "universal" {
			continue
		}
		if !deviceTypeMatches(deviceType, def.DeviceTypeMatch) {
			continue
		}
		if !seen[def.ParameterName] {
			seen[def.ParameterName] = true
			names = append(names, def.ParameterName)
		}
	}
	return names, nil
}

// PassiveParamNames returns the parameter names collected passively (from Inform)
// for a given device type.
func (r *MetricRepository) PassiveParamNames(ctx context.Context, deviceType string) ([]string, error) {
	defs, err := r.ListActive(ctx)
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool)
	var names []string
	for _, def := range defs {
		if def.Source != "passive" && def.Source != "universal" {
			continue
		}
		if !deviceTypeMatches(deviceType, def.DeviceTypeMatch) {
			continue
		}
		if !seen[def.ParameterName] {
			seen[def.ParameterName] = true
			names = append(names, def.ParameterName)
		}
	}
	return names, nil
}

// QueryAggregated returns aggregated metric data from a continuous aggregate
// table for a device within a time range.
func (r *MetricRepository) QueryAggregated(ctx context.Context, deviceID, metricID int64, from, to time.Time, bucket string) ([]models.AggregatedMetric, error) {
	table := caTableForBucket(bucket)
	if table == "" {
		return nil, fmt.Errorf("unsupported bucket: %s", bucket)
	}
	var rows []models.AggregatedMetric
	query := fmt.Sprintf(`
		SELECT time_bucket AS "timestamp", avg_value AS "avg", min_value AS "min", max_value AS "max", sample_count AS "count"
		FROM %s
		WHERE device_id = $1 AND metric_id = $2 AND time_bucket BETWEEN $3 AND $4
		ORDER BY time_bucket ASC`, table)
	err := r.db.WithContext(ctx).Raw(query, deviceID, metricID, from, to).Scan(&rows).Error
	return rows, err
}

// deviceTypeMatches checks whether a device type string matches a glob pattern.
func deviceTypeMatches(deviceType, pattern string) bool {
	if pattern == "" || pattern == "*" {
		return true
	}
	matched, _ := path.Match(pattern, deviceType)
	return matched
}

// caTableForBucket maps a bucket name to its continuous aggregate table.
func caTableForBucket(bucket string) string {
	switch bucket {
	case "5min":
		return "metric_samples_5min"
	case "1h":
		return "metric_samples_1h"
	case "1d":
		return "metric_samples_1d"
	default:
		return ""
	}
}

// SetupTimescaleDB creates the TimescaleDB extension, hypertable, continuous
// aggregates, retention policies, and compression policy. All statements are
// idempotent (IF NOT EXISTS / if_not_exists => TRUE).
func SetupTimescaleDB(db *gorm.DB) error {
	statements := []string{
		`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`,
		`SELECT create_hypertable('metric_samples', 'timestamp', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 day')`,
		`CREATE MATERIALIZED VIEW IF NOT EXISTS metric_samples_5min
		 WITH (timescaledb.continuous) AS
		 SELECT
			time_bucket(INTERVAL '5 minutes', "timestamp") AS time_bucket,
			device_id,
			metric_id,
			AVG(value)  AS avg_value,
			MIN(value)  AS min_value,
			MAX(value)  AS max_value,
			COUNT(*)    AS sample_count
		 FROM metric_samples
		 GROUP BY time_bucket, device_id, metric_id`,
		`CREATE MATERIALIZED VIEW IF NOT EXISTS metric_samples_1h
		 WITH (timescaledb.continuous) AS
		 SELECT
			time_bucket(INTERVAL '1 hour', "timestamp") AS time_bucket,
			device_id,
			metric_id,
			AVG(value)  AS avg_value,
			MIN(value)  AS min_value,
			MAX(value)  AS max_value,
			COUNT(*)    AS sample_count
		 FROM metric_samples
		 GROUP BY time_bucket, device_id, metric_id`,
		`CREATE MATERIALIZED VIEW IF NOT EXISTS metric_samples_1d
		 WITH (timescaledb.continuous) AS
		 SELECT
			time_bucket(INTERVAL '1 day', "timestamp") AS time_bucket,
			device_id,
			metric_id,
			AVG(value)  AS avg_value,
			MIN(value)  AS min_value,
			MAX(value)  AS max_value,
			COUNT(*)    AS sample_count
		 FROM metric_samples
		 GROUP BY time_bucket, device_id, metric_id`,
		`SELECT add_retention_policy('metric_samples', INTERVAL '6 hours', if_not_exists => TRUE)`,
		`SELECT add_retention_policy('metric_samples_5min', INTERVAL '7 days', if_not_exists => TRUE)`,
		`SELECT add_retention_policy('metric_samples_1h', INTERVAL '30 days', if_not_exists => TRUE)`,
		`SELECT add_retention_policy('metric_samples_1d', INTERVAL '365 days', if_not_exists => TRUE)`,
		`ALTER TABLE metric_samples SET (
			compresstimestamp = 'timestamp',
			compression_segmentby = 'device_id, metric_id'
		)`,
		`SELECT add_compression_policy('metric_samples', INTERVAL '2 hours', if_not_exists => TRUE)`,
	}

	for _, stmt := range statements {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("timescaledb setup: %w", err)
		}
	}
	log.Println("TimescaleDB setup completed (hypertable, CAs, retention, compression)")
	return nil
}

