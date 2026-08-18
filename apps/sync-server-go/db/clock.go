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
	if err := db.QueryRow("SELECT value FROM metadata WHERE key = ?", clockMetadataKey).Scan(&clockString); err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to read clock: %w", err)
	} else if err == nil {
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
		"INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
		clockMetadataKey, clock.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to persist clock: %w", err)
	}
	if err := db.QueryRow("SELECT value FROM metadata WHERE key = ?", clockMetadataKey).Scan(&clockString); err != nil {
		return nil, fmt.Errorf("failed to read clock: %w", err)
	}
	clock, err = hlc.FromString(clockString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse clock: %w", err)
	}
	return clock, nil
}
