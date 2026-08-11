package handlers

import (
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"sync"
	client "sync-server/db"
	"time"

	"sync-server/crypto"

	"google.golang.org/protobuf/proto"
	eventspb "proto/rllm/events"
)

type EventsHandler struct {
	Db *sql.DB
}

const defaultPageSize uint16 = 50

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
		pageSize = uint16(parsed)
	}
	hasMore := false
	nextAfter := after
	for {
		var params = make([]any, 0, 4)
		query := "SELECT data, signature, timestamp FROM messages WHERE accountId = ?"
		params = append(params, accountId)
		if clientId != "" {
			query += " AND clientId != ?"
			params = append(params, clientId)
		}
		if nextAfter != "" {
			query += " AND timestamp > ?"
			params = append(params, nextAfter)
		}
		query += " ORDER BY timestamp ASC LIMIT ?"
		params = append(params, pageSize+1)
		log.Printf("query: %s", query)
		rows, err := s.Db.Query(query, params...)
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to query messages: %v", err), http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		events := []*eventspb.SyncServerGetEventsResponsePayload{}
		for rows.Next() {
			event := &eventspb.SyncServerGetEventsResponsePayload{}
			if err := rows.Scan(&event.Data, &event.Signature, &event.Timestamp); err != nil {
				http.Error(w, fmt.Sprintf("failed to scan row: %v", err), http.StatusInternalServerError)
				return
			}
			events = append(events, event)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, fmt.Sprintf("failed to iterate rows: %v", err), http.StatusInternalServerError)
			return
		}

		hasMore = len(events) > int(pageSize)
		if hasMore {
			events = events[:pageSize]
			nextAfter = events[len(events)-1].Timestamp
		}
		message, err := proto.Marshal(&eventspb.SyncServerGetEventsResponse{
			HasMore:   hasMore,
			NextAfter: &nextAfter,
			PageSize:  uint32(pageSize),
			Events:    events,
		})
		if err != nil {
			http.Error(w, fmt.Sprintf("failed to marshal response: %v", err), http.StatusInternalServerError)
			return
		}
		header := make([]byte, 4)
		binary.LittleEndian.PutUint32(header, uint32(len(message)))
		w.Write(header)
		w.Write(message)
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

type tokenData struct {
	accountId string
	expiresAt uint
}

const AUTH_HEADER_PREFIX_LENGTH = len("BEARER ")

var tokens = struct {
	mu    sync.Mutex
	items map[string]tokenData
}{
	mu:    sync.Mutex{},
	items: map[string]tokenData{},
}

func (s EventsHandler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	tokens.mu.Lock()
	defer tokens.mu.Unlock()
	tokenHeader := r.Header.Get("authorization")
	if tokenHeader == "" || len(tokenHeader) < AUTH_HEADER_PREFIX_LENGTH+1 {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	tokenHeader = tokenHeader[AUTH_HEADER_PREFIX_LENGTH:]
	token, ok := tokens.items[tokenHeader]
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if token.expiresAt < uint(time.Now().Unix()) {
		delete(tokens.items, tokenHeader)
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	var body struct {
		AccountId string `json:"accountId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf("failed to decode JSON body: %v", err), http.StatusBadRequest)
		return
	}
	if token.accountId != body.AccountId {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	tx, err := s.Db.Begin()
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to begin transaction: %v", err), http.StatusInternalServerError)
		return
	}

	if _, err := tx.Exec("DELETE FROM messages WHERE accountId = ?", body.AccountId); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete messages: %v", err), http.StatusInternalServerError)
		tx.Rollback()
		err = tx.Rollback()
		if err != nil {
			log.Printf("failed to rollback transaction: %v", err)
		}
		return
	}
	if _, err := tx.Exec("DELETE FROM merkleTrees WHERE accountId = ?", body.AccountId); err != nil {
		http.Error(w, fmt.Sprintf("failed to delete merkle trees: %v", err), http.StatusInternalServerError)
		tx.Rollback()
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

type challengeData struct {
	nonce     string
	expiresAt uint
}

var challenges = struct {
	mu    sync.Mutex
	items map[string]challengeData
}{
	mu:    sync.Mutex{},
	items: map[string]challengeData{},
}

func (s EventsHandler) GetRequestChallenge(w http.ResponseWriter, r *http.Request) {
	challenges.mu.Lock()
	defer challenges.mu.Unlock()
	accountId := r.URL.Query().Get("accountId")
	if accountId == "" {
		http.Error(w, "accountId is required", http.StatusBadRequest)
		return
	}
	challenge := challengeData{
		nonce:     fmt.Sprintf("%x", time.Now().UnixNano()),
		expiresAt: uint(time.Now().Unix()) + 60*2,
	}
	challenges.items[accountId] = challenge
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(struct {
		Nonce string `json:"nonce"`
	}{Nonce: challenge.nonce})
}

func (s EventsHandler) PostVerifyChallenge(w http.ResponseWriter, r *http.Request) {
	challenges.mu.Lock()
	defer challenges.mu.Unlock()
	tokens.mu.Lock()
	defer tokens.mu.Unlock()
	var body struct {
		AccountId string `json:"accountId"`
		Nonce     string `json:"nonce"`
		Signature string `json:"signature"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, fmt.Sprintf("failed to decode JSON body: %v", err), http.StatusBadRequest)
		return
	}

	challenge, ok := challenges.items[body.AccountId]
	if !ok {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	delete(challenges.items, body.AccountId)

	if challenge.nonce != body.Nonce {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if challenge.expiresAt < uint(time.Now().Unix()) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	if !crypto.VerifyData([]byte(body.Nonce), body.Signature, body.AccountId) {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}

	token := fmt.Sprintf("%x", time.Now().UnixNano())
	tokens.items[token] = tokenData{
		accountId: body.AccountId,
		expiresAt: uint(time.Now().Unix()) + 60*5,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(struct {
		Token string `json:"token"`
	}{Token: token})
}
