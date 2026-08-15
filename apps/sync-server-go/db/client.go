package client

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"strings"
	"sync-server/db/migrations"

	_ "turso.tech/database/tursogo"
	turso "turso.tech/database/tursogo-serverless"

	"merkle-tree"
)

func InitDB() (*sql.DB, error) {
	dbUri := os.Getenv("DATABASE_CONNECTION_URL")
	if dbUri == "" {
		return nil, errors.New("DATABASE_CONNECTION_URL is not set")
	}
	driver := "turso"
	log.Printf("using database: %s", dbUri)
	dbAuthToken := os.Getenv("DATABASE_AUTH_TOKEN")
	if strings.HasPrefix(dbUri, "turso://") {
		db := sql.OpenDB(turso.NewConnector(
			dbUri,
			dbAuthToken,
		))
		return db, nil
	}
	if dbAuthToken != "" {
		dbUri += "?authToken=" + dbAuthToken
	}
	db, err := sql.Open(driver, dbUri)
	if err != nil {
		return nil, err
	}
	err = applyMigrations(db, migrations.All())
	if err != nil {
		return nil, err
	}
	return db, nil
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
	log.Printf("current database version: %s", currentVersion)
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for version, statements := range migrations {
		if currentVersion >= version {
			continue
		}
		log.Printf("applying migration %s", version)
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
		log.Printf("successfully applied migration %s", version)
	}
	err = tx.Commit()
	if err != nil {
		return err
	}
	var newVersion string
	err = db.QueryRow("SELECT value FROM metadata WHERE key = ?", "version").Scan(&newVersion)
	if err != nil {
		return err
	}
	log.Printf("new database version: %s", newVersion)
	return nil
}

func GetMerkleTreeByAccountId(db *sql.DB, accountId string) (*merkletree.MerkleTree[string, string], error) {
	var serializedTree string
	err := db.QueryRow("SELECT tree FROM `merkleTrees` where accountId = ?", accountId).Scan(&serializedTree)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return nil, err
	}
	var tree *merkletree.MerkleTree[string, string]
	if serializedTree == "" {
		tree, err = merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
	} else {
		tree, err = merkletree.FromJSON[string, string]([]byte(serializedTree), merkletree.StringHasher{})
	}
	if err != nil {
		return nil, err
	}
	return tree, nil
}
