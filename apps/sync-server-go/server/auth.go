package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"sync-server/crypto"
)

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
	expiresAt := time.Now().Add(time.Minute * 2)
	challenge := challengeData{
		nonce:     fmt.Sprintf("%x", time.Now().UnixNano()),
		expiresAt: uint(expiresAt.Unix()),
	}
	time.AfterFunc(
		time.Minute*2,
		func() {
			challenges.mu.Lock()
			defer challenges.mu.Unlock()
			if stored, ok := challenges.items[accountId]; ok && stored.nonce == challenge.nonce {
				delete(challenges.items, accountId)
			}
		})
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
	expiresAt := time.Now().Add(time.Minute * 5)
	tokens.items[token] = tokenData{
		accountId: body.AccountId,
		expiresAt: uint(expiresAt.Unix()),
	}
	time.AfterFunc(
		time.Minute*5,
		func() {
			tokens.mu.Lock()
			defer tokens.mu.Unlock()
			if stored, ok := tokens.items[token]; ok && stored.accountId == body.AccountId {
				delete(tokens.items, token)
			}
		})
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(struct {
		Token string `json:"token"`
	}{Token: token})
}
