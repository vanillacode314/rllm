package client

import (
	"database/sql"
	"errors"
	"fmt"

	"hlc/hlc"
)

const clockMetadataKey = "clock"

func GetLocalClock(db *sql.DB) (*hlc.HLC, error) {
	var clockString string
	err := db.QueryRow("SELECT value FROM metadata WHERE key = ?", clockMetadataKey).Scan(&clockString)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to read clock: %w", err)
	}
	if err == nil {
		clock, err := hlc.FromString(clockString)
		if err != nil {
			return nil, fmt.Errorf("failed to parse clock: %w", err)
		}
		return clock, nil
	}
	clock, err := hlc.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate clock: %w", err)
	}
	_, err = db.Exec(
		"INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
		clockMetadataKey, clock.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to persist clock: %w", err)
	}
	return clock, nil
}
