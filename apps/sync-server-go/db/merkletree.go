package db

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	merkletree "merkle-tree"
)

func (client *DbClient) GetMerkleTreeByAccountId(ctx context.Context, accountId string) (*merkletree.MerkleTree[string, string], error) {
	var serializedTree string
	err := client.db.QueryRowContext(ctx, "SELECT tree FROM `merkleTrees` where accountId = ?", accountId).Scan(&serializedTree)
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

const merkleTreePageSize = 1000

func (client *DbClient) RecomputeMerkleTree(ctx context.Context, accountId string) error {
	tx, err := client.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	tree, err := merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
	if err != nil {
		return fmt.Errorf("failed to create merkle tree: %w", err)
	}

	cursor := ""
	hasMore := true
	stmt, err := tx.PrepareContext(ctx, "SELECT timestamp FROM messages WHERE accountId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?")
	if err != nil {
		return fmt.Errorf("failed to prepare timestamp query: %w", err)
	}
	defer stmt.Close()

	for {
		timestamps, err := fetchTimestamps(ctx, stmt, accountId, cursor, merkleTreePageSize+1)
		if err != nil {
			return fmt.Errorf("failed to get timestamps: %w", err)
		}
		hasMore = len(timestamps) > merkleTreePageSize
		if hasMore {
			timestamps = timestamps[:merkleTreePageSize]
			cursor = timestamps[len(timestamps)-1]
		}

		items := make([]merkletree.Item[string, string], 0, len(timestamps))
		for _, ts := range timestamps {
			items = append(items, merkletree.Item[string, string]{
				Meta:  new(ts),
				Value: ts,
			})
		}
		tree.Insert(items)
		if !hasMore {
			break
		}
	}

	if tree.LeafCount() == 0 {
		_, err := tx.ExecContext(ctx, "DELETE FROM merkleTrees WHERE accountId = ?", accountId)
		if err != nil {
			return fmt.Errorf("failed to delete empty merkle tree: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit transaction: %w", err)
		}
		return nil
	}
	serialized, err := tree.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to serialize merkle tree: %w", err)
	}
	_, err = tx.ExecContext(ctx,
		"INSERT INTO merkleTrees (accountId, tree) VALUES (?, ?) ON CONFLICT(accountId) DO UPDATE SET tree = excluded.tree",
		accountId, string(serialized),
	)
	if err != nil {
		return fmt.Errorf("failed to persist merkle tree: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

func fetchTimestamps(ctx context.Context, stmt *sql.Stmt, accountId string, cursor string, pageSize uint) ([]string, error) {
	rows, err := stmt.QueryContext(ctx, accountId, cursor, pageSize)
	if err != nil {
		return nil, fmt.Errorf("query: %w", err)
	}
	defer rows.Close()

	timestamps := make([]string, 0, pageSize)
	for rows.Next() {
		var timestamp string
		if err := rows.Scan(&timestamp); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		timestamps = append(timestamps, timestamp)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate: %w", err)
	}
	return timestamps, nil
}
