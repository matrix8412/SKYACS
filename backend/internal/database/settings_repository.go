package database

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Setting struct {
	Key         string    `json:"key" gorm:"primaryKey"`
	Value       string    `json:"value"`
	Description string    `json:"description,omitempty"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

func (Setting) TableName() string {
	return "settings"
}

type SettingsRepository struct {
	db *gorm.DB
}

func NewSettingsRepository(db *gorm.DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

func (r *SettingsRepository) GetAll(ctx context.Context) ([]Setting, error) {
	var settings []Setting
	if err := r.db.WithContext(ctx).Order("key").Find(&settings).Error; err != nil {
		return nil, err
	}
	for index := range settings {
		if isSensitiveSettingKey(settings[index].Key) {
			value, err := decryptParameterValue(settings[index].Value)
			if err != nil {
				// A key rotation or stale volume can leave an undecryptable
				// value. Log and keep the raw ciphertext so the API still
				// responds; the operator can overwrite the field to recover.
				log.Printf("Warning: cannot decrypt setting %s: %v", settings[index].Key, err)
				continue
			}
			settings[index].Value = value
		}
	}
	return settings, nil
}

func (r *SettingsRepository) Get(ctx context.Context, key string) (*Setting, error) {
	var s Setting
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&s).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if isSensitiveSettingKey(s.Key) {
		value, decryptErr := decryptParameterValue(s.Value)
		if decryptErr != nil {
			log.Printf("Warning: cannot decrypt setting %s: %v", s.Key, decryptErr)
		} else {
			s.Value = value
		}
	}
	return &s, nil
}

func (r *SettingsRepository) SetMultiple(ctx context.Context, settings map[string]string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for key, value := range settings {
			if isSensitiveSettingKey(key) {
				var err error
				value, err = encryptParameterValue(value)
				if err != nil {
					return fmt.Errorf("encrypt setting %s: %w", key, err)
				}
			}
			err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "key"}},
				DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
			}).Create(&Setting{Key: key, Value: value, UpdatedAt: time.Now()}).Error
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func isSensitiveSettingKey(key string) bool {
	return key == "connection_request_password"
}

func (r *SettingsRepository) EncryptLegacySensitiveValues(ctx context.Context) (int64, error) {
	var settings []Setting
	if err := r.db.WithContext(ctx).Where("key IN ?", []string{"connection_request_password"}).Find(&settings).Error; err != nil {
		return 0, err
	}
	var encrypted int64
	for _, setting := range settings {
		if setting.Value == "" || strings.HasPrefix(setting.Value, encryptedParameterPrefix) {
			continue
		}
		value, err := encryptParameterValue(setting.Value)
		if err != nil {
			return encrypted, err
		}
		if err := r.db.WithContext(ctx).Model(&Setting{}).Where("key = ?", setting.Key).Update("value", value).Error; err != nil {
			return encrypted, err
		}
		encrypted++
	}
	return encrypted, nil
}
