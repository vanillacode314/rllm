package handlers

import (
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strconv"
	client "sync-server/db"
	"time"

	eventspb "proto/rllm/events"

	"google.golang.org/protobuf/proto"
)

type EventsHandler struct {
	Db *sql.DB
}

const defaultPageSize = 50

func (s EventsHandler) GetMessagesStream(w http.ResponseWriter, r *http.Request) {
	accountId := r.URL.Query().Get("accountId")
	clientId := r.URL.Query().Get("clientId")
	after := r.URL.Query().Get("after")
	pageSize := defaultPageSize
	if raw := r.URL.Query().Get("pageSize"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 16)
		if err != nil {
			http.Error(w, fmt.Sprintf("invalid pageSize got '%s', expected a positive integer", raw), http.StatusBadRequest)
			return
		}
		pageSize = int(parsed)
		if pageSize < 1 {
			http.Error(w, fmt.Sprintf("invalid pageSize got '%s', expected a positive integer", raw), http.StatusBadRequest)
			return
		}
	}
	hasMore := false
	cursor := after
	stmt, err := s.Db.Prepare("SELECT data, signature, timestamp FROM messages WHERE accountId = ? AND clientId != ? AND timestamp > ? ORDER BY timestamp ASC LIMIT ?")
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to prepare statement: %v", err), http.StatusInternalServerError)
		return
	}
	defer stmt.Close()
	for {
		rows, err := stmt.Query(accountId, clientId, cursor, pageSize+1)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to query messages: %v", err), http.StatusInternalServerError)
			return
		}

		events := []*eventspb.SyncServerGetEventsResponsePayload{}
		for rows.Next() {
			event := &eventspb.SyncServerGetEventsResponsePayload{}
			if err := rows.Scan(&event.Data, &event.Signature, &event.Timestamp); err != nil {
				http.Error(w, fmt.Sprintf("failed to scan row: %v", err), http.StatusInternalServerError)
				closeError := rows.Close()
				if closeError != nil {
					http.Error(w, fmt.Sprintf("failed to close rows: %v", errors.Join(err, closeError)), http.StatusInternalServerError)
					return
				}
				return
			}
			events = append(events, event)
		}
		closeError := rows.Close()
		if closeError != nil {
			http.Error(w, fmt.Sprintf("failed to close rows: %v", closeError), http.StatusInternalServerError)
			return
		}
		if err := rows.Err(); err != nil {
			http.Error(w, fmt.Sprintf("failed to iterate rows: %v", err), http.StatusInternalServerError)
			return
		}

		hasMore = len(events) > int(pageSize)
		if hasMore {
			events = events[:pageSize]
			cursor = events[pageSize-1].Timestamp
		}
		message, err := proto.Marshal(&eventspb.SyncServerGetEventsResponse{
			HasMore:   hasMore,
			NextAfter: &cursor,
			PageSize:  uint32(pageSize),
			Events:    events,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
			return
		}
		header := make([]byte, 4)
		binary.LittleEndian.PutUint32(header, uint32(len(message)))
		_, err = w.Write(header)
		if err != nil {
			log.Printf("failed to write header: %v", err)
			return
		}
		_, err = w.Write(message)
		if err != nil {
			log.Printf("failed to write message: %v", err)
			return
		}
		if !hasMore {
			break
		}
	}
}

func (s EventsHandler) GetId(w http.ResponseWriter, r *http.Request) {
	clock, err := client.GetLocalClock(s.Db)
	if err != nil {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Write([]byte(clock.ClientID))
}

func (s EventsHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	tokens.mu.Lock()
	tokenHeader := r.Header.Get("authorization")
	if tokenHeader == "" || len(tokenHeader) < AUTH_HEADER_PREFIX_LENGTH+1 {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	tokenHeader = tokenHeader[AUTH_HEADER_PREFIX_LENGTH:]
	token, ok := tokens.items[tokenHeader]
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	if token.expiresAt < uint(time.Now().Unix()) {
		delete(tokens.items, tokenHeader)
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}

	var body struct {
		AccountId string `json:"accountId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf("failed to decode JSON body: %v", err), http.StatusBadRequest)
		tokens.mu.Unlock()
		return
	}
	if token.accountId != body.AccountId {
		w.WriteHeader(http.StatusUnauthorized)
		tokens.mu.Unlock()
		return
	}
	tokens.mu.Unlock()
	tx, err := s.Db.Begin()
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to begin transaction: %v", err), http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec("DELETE FROM messages WHERE accountId = ?", body.AccountId); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete messages: %v", err), http.StatusInternalServerError)
		err = tx.Rollback()
		if err != nil {
			log.Printf("failed to rollback transaction: %v", err)
		}
		return
	}
	if _, err := tx.Exec("DELETE FROM merkleTrees WHERE accountId = ?", body.AccountId); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete merkle trees: %v", err), http.StatusInternalServerError)
		err = tx.Rollback()
		if err != nil {
			log.Printf("failed to rollback transaction: %v", err)
		}
		return
	}
	if err := tx.Commit(); err != nil {
		http.Error(w, fmt.Sprintf("failed to commit transaction: %v", err), http.StatusInternalServerError)
		err = tx.Rollback()
		if err != nil {
			log.Printf("failed to rollback transaction: %v", err)
		}
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
