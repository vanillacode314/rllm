package handlers

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"proto/peers"
	sigcrypto "sync-server/crypto"
	client "sync-server/db"
	"sync-server/digest"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"
)

type SocketHandler struct {
	Db  *sql.DB
	Hub *Hub
}

const wsPingInterval = 20 * time.Second
const wsPingTimeout = 5 * time.Second
const wsReadLimitBytes = 10 * 1024 * 1024

func (s SocketHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	accountID := r.URL.Query().Get("accountId")
	if accountID == "" {
		http.Error(w, "missing accountId query parameter", http.StatusBadRequest)
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{"*"}})
	if err != nil {
		log.Printf("%v", err)
		return
	}
	go s.keepAlive(ctx, conn)
	conn.SetReadLimit(wsReadLimitBytes)
	clock, err := client.GetLocalClock(s.Db)
	if err != nil {
		log.Printf("[WS Open] Failed to get local clock: %v", err)
		conn.CloseNow()
		return
	}
	connectionManager := newConnectionManager(s.Db, accountID, clock.ClientID, conn, s.Hub)
	s.Hub.Subscribe(accountID, conn)
	defer func() {
		s.Hub.Unsubscribe(accountID, conn)
		connectionManager.close()
		conn.CloseNow()
	}()

	log.Printf("[WS Open] Client connected: accountId=%s", accountID)
	tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
	if err != nil {
		log.Printf("[WS Open] Failed to get merkle tree: %v", err)
		return
	}
	rootDigest := tree.GetRootHash()
	connectionManager.write(connectionManager.createHandshake("__any__", rootDigest, clock.ClientID))

	for {
		typ, rawMessage, err := conn.Read(ctx)
		if err != nil {
			if errors.Is(err, io.EOF) || websocket.CloseStatus(err) != -1 {
				log.Println("Client disconnected cleanly")
			} else {
				log.Printf("Connection error: %v", err)
			}
			break
		}
		if typ != websocket.MessageBinary {
			log.Printf("[WS] Received non-binary message, closing")
			break
		}
		message := peers.SyncWireMessage{}
		if err := proto.Unmarshal(rawMessage, &message); err != nil {
			log.Printf("[WS] Failed to unmarshal message: %v", err)
			continue
		}
		if message.AccountId != accountID {
			log.Printf("[WS Warn] accountId mismatch: expected=%s got=%s", accountID, message.AccountId)
			continue
		}
		s.handleMessage(&message, connectionManager, clock.ClientID)
	}
}

func (s SocketHandler) handleMessage(message *peers.SyncWireMessage, connectionManager *ConnectionManager, clientId string) {
	accountID := connectionManager.accountID
	log.Printf("[WS Received Message] accountId=%s case=%T", accountID, message.Payload)

	switch payload := message.Payload.(type) {
	case *peers.SyncWireMessage_Handshake:
		log.Printf("[WS Handshake] accountId=%s clientId=%s version=%s", accountID, message.ClientId, payload.Handshake.GetVersion())
		if payload.Handshake.GetRootDigest() == nil {
			log.Printf("[WS Handshake] Invalid handshake root digest missing")
			return
		}
		if payload.Handshake.GetClientId() == "" {
			log.Printf("[WS Handshake] Invalid handshake clientId missing")
			return
		}
		tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
		if err != nil {
			log.Printf("[WS Error] Failed to load tree: %v", err)
			return
		}
		shouldQuery := strings.Compare(clientId, *payload.Handshake.ClientId) == 1
		ourRootDigest := tree.GetRootHash()
		mismatch := digest.DigestsDiffer(ourRootDigest, payload.Handshake.RootDigest)
		if !mismatch {
			log.Printf("[WS Handshake] Root digest matches")
		}
		if !shouldQuery {
			return
		}
		if mismatch {
			log.Printf("[WS Handshake] Root digest mismatch")
			paths := make([][]uint32, 16)
			for i := range tree.Arity() {
				paths[i] = []uint32{uint32(i)}
			}
			connectionManager.write(connectionManager.createDigestQuery(uint32(tree.MaxDepth()), paths))
			return
		}

	case *peers.SyncWireMessage_DigestQuery:
		q := payload.DigestQuery
		log.Printf("[WS DigestQuery] accountId=%s merkleDepth=%d paths=%d", accountID, q.GetMerkleDepth(), len(q.GetPaths()))
		tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
		if err != nil {
			log.Printf("[WS Error] Failed to load tree: %v", err)
			return
		}
		digests := digest.HandleDigestQuery(tree, q.GetMerkleDepth(), q.GetPaths())
		connectionManager.write(marshalMessage(&peers.SyncWireMessage{
			AccountId: accountID,
			ClientId:  connectionManager.clientID,
			Payload: &peers.SyncWireMessage_DigestUpdate{
				DigestUpdate: &peers.MerkleDigestUpdate{
					MerkleDepth: uint32(tree.MaxDepth()),
					Digests:     digests,
				},
			},
		}))

	case *peers.SyncWireMessage_SendEventWithTimestamp:
		log.Printf("[WS SendEventWithTimestampQuery] accountId=%s", accountID)
		timestamps := payload.SendEventWithTimestamp.Timestamps
		for _, timestamp := range timestamps {
			connectionManager.sendTimestamp(timestamp)
		}

	case *peers.SyncWireMessage_DigestUpdate:
		u := payload.DigestUpdate
		log.Printf("[WS DigestUpdate] accountId=%s digests=%d merkleDepth=%d", accountID, len(u.GetDigests()), u.GetMerkleDepth())
		tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
		if err != nil {
			log.Printf("[WS Error] Failed to load tree: %v", err)
			return
		}
		for _, action := range digest.HandleDigestUpdate(tree, u.GetMerkleDepth(), u.GetDigests()) {
			switch action.Kind {
			case digest.KindQueryChildren:
				connectionManager.write(connectionManager.createDigestQuery(uint32(tree.MaxDepth()), action.Children))
			case digest.KindSendTimestamp:
				connectionManager.sendTimestamp(action.Timestamp)
			case digest.KindAskTimestamp:
				connectionManager.sendSendEventWithTimestamp(action.Timestamp)
			case digest.KindHasEventQuery:
				connectionManager.sendHasEventWithTimestampQuery(action.Timestamp)
			}
		}

	case *peers.SyncWireMessage_HasEventWithTimestampQuery:
		q := payload.HasEventWithTimestampQuery
		log.Printf("[WS HasEventQuery] accountId=%s timestamps=%v", accountID, q.GetTimestamps())
		for _, timestamp := range q.GetTimestamps() {
			connectionManager.sendHasEventWithTimestampUpdate(timestamp)
		}

	case *peers.SyncWireMessage_HasEventWithTimestampUpdates:
		u := payload.HasEventWithTimestampUpdates
		log.Printf("[WS HasEventUpdate] accountId=%s updates=%d", accountID, len(u.GetUpdates()))
		for _, update := range u.GetUpdates() {
			if !update.GetYes() {
				connectionManager.sendTimestamp(update.GetTimestamp())
			}
		}

	case *peers.SyncWireMessage_EventBatch:
		events := payload.EventBatch.GetEvents()
		log.Printf("[WS EventBatch] accountId=%s events=%d", accountID, len(events))
		verified := true
		for _, event := range events {
			if !sigcrypto.VerifyData(event.GetData(), event.GetSignature(), accountID) {
				verified = false
				break
			}
		}
		if !verified {
			log.Printf("[WS EventBatch] Signature verification failed: accountId=%s", accountID)
			return
		}
		tx, err := s.Db.Begin()
		if err != nil {
			log.Printf("[WS Error] Failed to begin transaction: %v", err)
			return
		}
		messages := make([]client.Message, 0, len(events))
		for _, event := range events {
			messages = append(messages, client.Message{
				Data:      event.GetData(),
				Signature: event.GetSignature(),
				Timestamp: event.GetTimestamp(),
			})
		}
		if err := client.ReceiveMessages(tx, accountID, message.ClientId, messages); err != nil {
			_ = tx.Rollback()
			log.Printf("[WS Error] Failed to receive messages: %v", err)
			return
		}
		if err := tx.Commit(); err != nil {
			log.Printf("[WS Error] Failed to commit transaction: %v", err)
			return
		}
		s.Hub.Publish(accountID, connectionManager.conn, connectionManager.createEventBatch(events))
		connectionManager.recomputeMerkleTree()

	default:
	}
}

func (s SocketHandler) keepAlive(ctx context.Context, c *websocket.Conn) {
	t := time.NewTicker(wsPingInterval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			pctx, cancel := context.WithTimeout(ctx, wsPingTimeout)
			err := c.Ping(pctx)
			cancel()
			if err != nil {
				c.CloseNow()
				return
			}
		case <-ctx.Done():
			return
		}
	}
}
