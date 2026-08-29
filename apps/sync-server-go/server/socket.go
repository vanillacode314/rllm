package handlers

import (
	"context"
	"database/sql"
	"errors"
	"io"
	"log"
	"net/http"
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
	clientID := r.URL.Query().Get("clientId")
	peer := r.URL.Query().Get("peer") == "true"
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
	connectionManager := newConnectionManager(s.Db, accountID, clock.ClientID, conn, s.Hub, &Client{
		id:   clientID,
		conn: conn,
		peer: peer,
	},
	)
	s.Hub.Subscribe(accountID, connectionManager.client)
	if peer {
		s.Hub.Publish(accountID, connectionManager.client, connectionManager.createPeerConnected(clientID))
	}
	defer func() {
		s.Hub.Unsubscribe(accountID, connectionManager.client)
		s.Hub.RemovePeer(accountID, clientID)
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
		shouldQuery := clientId > payload.Handshake.ClientId
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
			paths := make([][]uint32, tree.Arity())
			for i := range tree.Arity() {
				paths[i] = []uint32{uint32(i)}
			}
			connectionManager.addPendingDigestUpdates(len(paths))
			connectionManager.write(connectionManager.createDigestQuery(uint32(tree.MaxDepth()), paths))
			return
		}

	case *peers.SyncWireMessage_DigestQueries:
		q := payload.DigestQueries
		log.Printf("[WS DigestQueries] accountId=%s merkleDepth=%d queries=%d", accountID, q.GetMerkleDepth(), len(q.GetQueries()))
		tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
		if err != nil {
			log.Printf("[WS Error] Failed to load tree: %v", err)
			return
		}
		updates := digest.HandleDigestQuery(tree, q.GetMerkleDepth(), q.GetQueries())
		connectionManager.write(marshalMessage(&peers.SyncWireMessage{
			AccountId: accountID,
			ClientId:  connectionManager.clientID,
			Payload: &peers.SyncWireMessage_DigestUpdates{
				DigestUpdates: &peers.DigestUpdates{
					MerkleDepth: uint32(tree.MaxDepth()),
					Updates:     updates,
				},
			},
		}))

	case *peers.SyncWireMessage_DigestUpdates:
		u := payload.DigestUpdates
		log.Printf("[WS DigestUpdates] accountId=%s updates=%d merkleDepth=%d", accountID, len(u.GetUpdates()), u.GetMerkleDepth())
		tree, err := client.GetMerkleTreeByAccountId(s.Db, accountID)
		if err != nil {
			log.Printf("[WS Error] Failed to load tree: %v", err)
			return
		}
		connectionManager.subPendingDigestUpdates(len(u.GetUpdates()))
		action := digest.HandleDigestUpdate(tree, u.GetMerkleDepth(), u.GetUpdates())
		if action == nil {
			return
		}
		switch action.Kind {
		case digest.KindQueryChildren:
			connectionManager.addPendingDigestUpdates(len(action.Children))
			connectionManager.write(connectionManager.createDigestQuery(uint32(tree.MaxDepth()), action.Children))
		case digest.KindAskTimestamp:
			connectionManager.write(connectionManager.createSendEventsWithTimestamp(action.Timestamp))
			connectionManager.sendAfterTimestamp(action.Timestamp)
		}

	case *peers.SyncWireMessage_SendEventsAfterTimestamp:
		log.Printf("[WS SendEventsAfterTimestamp] accountId=%s", accountID)
		connectionManager.sendAfterTimestamp(payload.SendEventsAfterTimestamp.Timestamp)

	case *peers.SyncWireMessage_WebrtcSignal:
		log.Printf("[WS WebrtcSignal] accountId=%s to=%s", accountID, payload.WebrtcSignal.To)
		peers := s.Hub.PeerClients(accountID, payload.WebrtcSignal.To)
		for _, peer := range peers {
			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := peer.conn.Write(ctx, websocket.MessageBinary, connectionManager.createWebRTCSignal(message.ClientId, payload.WebrtcSignal.To, payload.WebrtcSignal.Data))
			cancel()
			if err != nil {
				log.Printf("[WS Error] Failed to send WebRTC signal: %v", err)
			}
			log.Printf("[WS WebrtcSignal] Sent WebRTC signal to %s", peer.id)
		}

	case *peers.SyncWireMessage_ConnectedToPeer:
		log.Printf("[WS ConnectedToPeer] accountId=%s", accountID)
		s.Hub.AddPeer(accountID, message.ClientId, payload.ConnectedToPeer.PeerId)

	case *peers.SyncWireMessage_DisconnectedFromPeer:
		log.Printf("[WS DisconnectedFromPeer] accountId=%s", accountID)
		s.Hub.RemovePeerForMe(accountID, message.ClientId, payload.DisconnectedFromPeer.PeerId)

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
		nInserted, err := client.ReceiveMessages(tx, accountID, message.ClientId, messages)
		if err != nil {
			_ = tx.Rollback()
			log.Printf("[WS Error] Failed to receive messages: %v", err)
			return
		}
		if err := tx.Commit(); err != nil {
			_ = tx.Rollback()
			log.Printf("[WS Error] Failed to commit transaction: %v", err)
			return
		}
		log.Printf("[WS EventBatch] Inserted %d messages", nInserted)
		s.Hub.Publish(accountID, connectionManager.client, connectionManager.createEventBatch(events))
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
