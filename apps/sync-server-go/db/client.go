package client

import (
	"database/sql"
	"errors"
	"log"
	"os"
	"strings"

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
	return sql.Open(driver, dbUri)
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
