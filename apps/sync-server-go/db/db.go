package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"hlc/hlc"
	"log/slog"
	"slices"
	"strings"
	"sync-server/db/migrations"

	_ "turso.tech/database/tursogo"
	turso "turso.tech/database/tursogo-serverless"
)

type DbClient struct {
	db *sql.DB
}

func NewClient(uri string, token string) (*DbClient, error) {
	driver := "turso"
	if strings.HasPrefix(uri, "turso://") {
		db := sql.OpenDB(turso.NewConnector(uri, token))
		if err := applyMigrations(db, migrations.All()); err != nil {
			return nil, err
		}
		return &DbClient{db}, nil
	}
	if token != "" {
		uri += "?authToken=" + token
	}
	db, err := sql.Open(driver, uri)
	if err != nil {
		return nil, err
	}
	if err := applyMigrations(db, migrations.All()); err != nil {
		return nil, err
	}
	return &DbClient{db}, nil
}

func (db *DbClient) Close() error {
	return db.db.Close()
}

func applyMigrations(db *sql.DB, migrations map[string][]string) error {
	db.Exec(`CREATE TABLE IF NOT EXISTS metadata (
						 key text PRIMARY KEY NOT NULL,
						 value text NOT NULL
					 )`)
	var currentVersion string = "0"
	err := db.QueryRow("SELECT value FROM metadata WHERE key = ?", "version").Scan(&currentVersion)
	if err != nil && err != sql.ErrNoRows {
		return err
	}
	var migrationsToApply []string
	for version := range migrations {
		if currentVersion < version {
			migrationsToApply = append(migrationsToApply, version)
		}
	}
	slices.Sort(migrationsToApply)
	if len(migrationsToApply) == 0 {
		slog.Debug("no migrations to apply")
		return nil
	}
	slog.Info("applying migrations", "currentVersion", currentVersion)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, version := range migrationsToApply {
		statements := migrations[version]
		slog.Info("applying migration", "version", version)
		for _, sql := range statements {
			_, err := tx.Exec(sql)
			if err != nil {
				rollbackErr := tx.Rollback()
				if rollbackErr != nil {
					panic(errors.Join(errors.New("failed to apply migration "+version), err, rollbackErr))
				}
				panic(errors.Join(errors.New("failed to apply migration "+version), err))
			}
		}
		_, err := tx.Exec("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)", "version", version)
		if err != nil {
			rollbackErr := tx.Rollback()
			if rollbackErr != nil {
				panic(errors.Join(errors.New("failed to apply migration "+version), err, rollbackErr))
			}
			panic(errors.Join(errors.New("failed to apply migration "+version), err))
		}
		slog.Info("successfully applied migration", "version", version)
	}
	err = tx.Commit()
	if err != nil {
		rollbackErr := tx.Rollback()
		if rollbackErr != nil {
			panic(errors.Join(errors.New("failed to commit migrations"), err, rollbackErr))
		}
		panic(errors.Join(errors.New("failed to commit migrations"), err))
	}
	var newVersion string
	err = db.QueryRow("SELECT value FROM metadata WHERE key = ?", "version").Scan(&newVersion)
	if err != nil {
		return err
	}
	slog.Info("new database version", "version", newVersion)
	return nil
}

func (db *DbClient) GetId(ctx context.Context) (string, error) {
	clock, err := getLocalClock(ctx, db.db)
	if err != nil {
		return "", fmt.Errorf("failed to get local clock: %w", err)
	}
	return clock.ClientID, nil
}

const clockMetadataKey = "clock"

func getLocalClock(ctx context.Context, db *sql.DB) (*hlc.HLC, error) {
	var clockString string
	if err := db.QueryRowContext(ctx, "SELECT value FROM metadata WHERE key = ?", clockMetadataKey).Scan(&clockString); err != nil && !errors.Is(err, sql.ErrNoRows) {
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
	_, err = db.ExecContext(ctx,
		"INSERT INTO metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
		clockMetadataKey, clock.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to persist clock: %w", err)
	}
	if err := db.QueryRowContext(ctx, "SELECT value FROM metadata WHERE key = ?", clockMetadataKey).Scan(&clockString); err != nil {
		return nil, fmt.Errorf("failed to read clock: %w", err)
	}
	clock, err = hlc.FromString(clockString)
	if err != nil {
		return nil, fmt.Errorf("failed to parse clock: %w", err)
	}
	return clock, nil
}

func (db *DbClient) DeleteAccount(ctx context.Context, accountId string) error {
	tx, err := db.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, "DELETE FROM messages WHERE accountId = ?", accountId); err != nil {
		return fmt.Errorf("failed to delete messages: %w", err)
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM merkleTrees WHERE accountId = ?", accountId); err != nil {
		return fmt.Errorf("failed to delete merkle trees: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}
