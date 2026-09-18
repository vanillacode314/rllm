package db

import (
	"context"
	"fmt"
	"strings"
)

type Message struct {
	Data      []byte
	Signature string
	Timestamp string
}

func (client *DbClient) ReceiveMessages(ctx context.Context, accountId string, clientId string, events []Message) (int, error) {
	tx, err := client.db.BeginTx(ctx, nil)
	if err != nil {
		return -1, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, "INSERT INTO messages (accountId, clientId, data, signature, timestamp) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING")
	if err != nil {
		return -1, fmt.Errorf("failed to prepare insert statement: %w", err)
	}
	defer stmt.Close()

	nInserted := 0
	for _, event := range events {
		result, err := stmt.ExecContext(ctx, accountId, clientId, event.Data, event.Signature, event.Timestamp)
		if err != nil {
			return -1, fmt.Errorf("failed to insert message %s: %w", event.Timestamp, err)
		}
		n, err := result.RowsAffected()
		nInserted += int(n)
		if err != nil {
			return -1, fmt.Errorf("failed to insert message %s: %w", event.Timestamp, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return -1, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nInserted, nil
}

func (client *DbClient) GetMessagesByTimestamps(ctx context.Context, accountId string, timestamps []string) ([]Message, error) {
	if len(timestamps) == 0 {
		return nil, nil
	}
	query := "SELECT data, signature, timestamp FROM messages WHERE accountId = ? AND timestamp IN"
	query += " (" + strings.Repeat("?, ", len(timestamps)-1) + "?)"

	params := make([]any, 0, len(timestamps)+1)
	params = append(params, accountId)
	for _, ts := range timestamps {
		params = append(params, ts)
	}

	rows, err := client.db.QueryContext(ctx, query, params...)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

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

func (client *DbClient) GetMessagesAfterTimestamp(ctx context.Context, accountId string, timestamp string) ([]Message, error) {
	rows, err := client.db.QueryContext(ctx, "SELECT data, signature, timestamp FROM messages WHERE accountId = ? AND timestamp > ? ORDER BY timestamp ASC", accountId, timestamp)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	events := make([]Message, 0)
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.Data, &m.Signature, &m.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		events = append(events, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate rows: %w", err)
	}
	return events, nil
}

func (client *DbClient) GetMessagesByCursor(ctx context.Context, accountId string, cursor string, pageSize uint) ([]Message, error) {
	rows, err := client.db.QueryContext(ctx, "SELECT data, signature, timestamp FROM messages WHERE accountId = ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?", accountId, cursor, pageSize)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	events := make([]Message, 0, pageSize)
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.Data, &m.Signature, &m.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		events = append(events, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate rows: %w", err)
	}
	return events, nil
}
