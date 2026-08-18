package client

import (
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"strings"

	"merkle-tree"
)

// Message is a single stored event row.
type Message struct {
	Data      []byte
	Signature string
	Timestamp string
}

// ReceiveMessages inserts events into the messages table, skipping rows that
// already exist (primary key: accountId + timestamp). All rows are written in
// a single transaction owned by the caller.
func ReceiveMessages(tx *sql.Tx, accountID string, clientID string, events []Message) (int, error) {
	stmt, err := tx.Prepare("INSERT INTO messages (accountId, clientId, data, signature, timestamp) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
	if err != nil {
		return -1, fmt.Errorf("failed to prepare insert statement: %w", err)
	}
	defer stmt.Close()

	nInserted := 0
	for _, event := range events {
		result, err := stmt.Exec(accountID, clientID, event.Data, event.Signature, event.Timestamp)
		if err != nil {
			return -1, fmt.Errorf("failed to insert message %s: %w", event.Timestamp, err)
		}
		n, err := result.RowsAffected()
		nInserted += int(n)
		if err != nil {
			return -1, fmt.Errorf("failed to insert message %s: %w", event.Timestamp, err)
		}
	}
	return nInserted, nil
}

// GetMessagesByTimestamps returns stored events for the given timestamps,
// preserving the order of the timestamps argument (missing timestamps are
// omitted).
func GetMessagesByTimestamps(db *sql.DB, accountID string, timestamps []string) ([]Message, error) {
	if len(timestamps) == 0 {
		return nil, nil
	}
	query := "SELECT data, signature, timestamp FROM messages WHERE accountId = ? AND timestamp IN"
	query += " (" + strings.Repeat("?, ", len(timestamps)-1) + "?)"

	params := make([]any, 0, len(timestamps)+1)
	params = append(params, accountID)
	params = slices.Grow(params, len(timestamps))
	for _, ts := range timestamps {
		params = append(params, ts)
	}

	rows, err := db.Query(query, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	// Reconstruct in request order via an index map.
	byTimestamp := make(map[string]Message, len(timestamps))
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.Data, &m.Signature, &m.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		byTimestamp[m.Timestamp] = m
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate rows: %w", err)
	}

	events := make([]Message, 0, len(timestamps))
	for _, ts := range timestamps {
		if m, ok := byTimestamp[ts]; ok {
			events = append(events, m)
		}
	}
	return events, nil
}

const merkleTreePageSize = 1000

// RecomputeMerkleTree rebuilds the account's merkle tree from the messages
// table (paged, ordered by timestamp ascending) and upserts it. Idempotent.
func RecomputeMerkleTree(db *sql.DB, accountID string) error {
	tree, err := merkletree.NewMerkleTree[string, string](16, merkletree.StringHasher{})
	if err != nil {
		return fmt.Errorf("failed to create merkle tree: %w", err)
	}
	cursor := ""
	hasMore := true
	stmt, err := db.Prepare("SELECT timestamp FROM messages WHERE accountId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?")
	if err != nil {
		return fmt.Errorf("failed to prepare timestamp query: %w", err)
	}
	defer stmt.Close()

	for {
		rows, err := stmt.Query(accountID, cursor, merkleTreePageSize+1)
		if err != nil {
			return fmt.Errorf("failed to query timestamps: %w", err)
		}
		timestamps := make([]string, 0, merkleTreePageSize+1)
		for rows.Next() {
			var ts string
			if err := rows.Scan(&ts); err != nil {
				closeError := rows.Close()
				if closeError != nil {
					return fmt.Errorf("failed to close rows: %w", errors.Join(err, closeError))
				}
				return fmt.Errorf("failed to scan timestamp: %w", err)
			}
			timestamps = append(timestamps, ts)
		}
		hasMore = len(timestamps) > merkleTreePageSize
		if hasMore {
			timestamps = timestamps[:merkleTreePageSize]
			cursor = timestamps[len(timestamps)-1]
		}
		closeError := rows.Close()
		if closeError != nil {
			return fmt.Errorf("failed to close rows: %w", closeError)
		}
		if err := rows.Err(); err != nil {
			return fmt.Errorf("failed to iterate timestamps: %w", err)
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

	serialized, err := tree.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to serialize merkle tree: %w", err)
	}
	_, err = db.Exec(
		"INSERT INTO merkleTrees (accountId, tree) VALUES (?, ?) ON CONFLICT(accountId) DO UPDATE SET tree = excluded.tree",
		accountID, string(serialized),
	)
	if err != nil {
		return fmt.Errorf("failed to persist merkle tree: %w", err)
	}
	return nil
}
