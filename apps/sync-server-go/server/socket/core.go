package socket

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"proto/peerspb"
	"pubsub"
	"sync"
	"sync-server/db"
	"time"

	"github.com/coder/websocket"
	"google.golang.org/protobuf/proto"
)

type Transport interface {
	Send(ctx context.Context, message *peerspb.PeerMessagePayload) error
	Publish(ctx context.Context, message *peerspb.PeerMessagePayload, topic string) error
}

type SocketPlugin interface {
	AttachTransport(transport Transport)
	Handle(ctx context.Context, message *peerspb.PeerMessagePayload, accountId string, remotePeerId string, id string) error
}

type PublishedMessage struct {
	topic   string
	payload *peerspb.PeerMessagePayload
	as      string
}

type Connection struct {
	id           string
	accountId    string
	remotePeerId string
	conn         *websocket.Conn
	plugins      []SocketPlugin
	db           *db.DbClient
	hub          *pubsub.Hub[PublishedMessage]
	subscribedTo map[string]struct{}
	subsMu       sync.RWMutex
	publish      func(topic string, v *peerspb.PeerMessagePayload, as string) error
}

const wsPingInterval = 20 * time.Second
const wsPingTimeout = 5 * time.Second
const wsReadLimitBytes = 10 * 1024 * 1024

func parseQuery(query url.Values) (string, string, error) {
	accountId := query.Get("accountId")
	clientId := query.Get("clientId")
	if accountId == "" {
		return "", "", errors.New("missing required query parameter: accountId")
	}
	if clientId == "" {
		return "", "", errors.New("missing required query parameter: remotePeerId")
	}
	return accountId, clientId, nil
}

func NewConnection(db *db.DbClient, hub *pubsub.Hub[PublishedMessage], plugins ...SocketPlugin) *Connection {
	conn := &Connection{db: db, hub: hub, subscribedTo: map[string]struct{}{}}
	for _, plugin := range plugins {
		conn.registerPlugin(plugin)
	}
	return conn
}

func (c *Connection) registerPlugin(plugin SocketPlugin) {
	plugin.AttachTransport(c)
	c.plugins = append(c.plugins, plugin)
}

func (c *Connection) sendMessage(ctx context.Context, message *peerspb.PeerMessage) error {
	bytes, err := proto.Marshal(message)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}
	if err := c.conn.Write(ctx, websocket.MessageBinary, bytes); err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}
	return nil
}

func (c *Connection) PublishAs(ctx context.Context, message *peerspb.PeerMessagePayload, topic string, as string) error {
	if c.publish == nil {
		return errors.New("publish function not initialized")
	}
	return c.publish(topic, message, as)
}

func (c *Connection) Publish(ctx context.Context, message *peerspb.PeerMessagePayload, topic string) error {
	if c.publish == nil {
		return errors.New("publish function not initialized")
	}
	return c.publish(topic, message, "")
}

func (c *Connection) SendAs(ctx context.Context, message *peerspb.PeerMessagePayload, as string) error {
	if err := c.sendMessage(ctx, &peerspb.PeerMessage{AccountId: c.accountId, ClientId: as, Message: message}); err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	return nil
}

func (c *Connection) Send(ctx context.Context, message *peerspb.PeerMessagePayload) error {
	slog.InfoContext(ctx, "sending message", "message", message)
	if err := c.sendMessage(ctx, &peerspb.PeerMessage{AccountId: c.accountId, ClientId: c.remotePeerId, Message: message}); err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}
	return nil
}

func (c *Connection) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	accountId, clientId, err := parseQuery(r.URL.Query())
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	c.accountId = accountId
	c.remotePeerId = clientId
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: []string{"*"}})
	if err != nil {
		slog.ErrorContext(ctx, "failed to accept connection", "error", err)
		return
	}
	c.conn = conn
	go c.keepAlive(ctx)
	c.conn.SetReadLimit(wsReadLimitBytes)
	defer c.conn.CloseNow()
	id, err := c.db.GetId(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "failed to get client id", "error", err)
		return
	}
	c.id = id
	subscription := c.hub.Subscribe(accountId, func(message PublishedMessage) {
		slog.InfoContext(ctx, "received message", "accountId", accountId, "remotePeerId", c.remotePeerId, "topic", message.topic)
		c.subsMu.RLock()
		_, isSubscribed := c.subscribedTo[message.topic]
		c.subsMu.RUnlock()

		if !isSubscribed {
			return
		}
		as := c.remotePeerId
		if message.as != "" {
			as = message.as
		}
		if err := c.SendAs(ctx, message.payload, as); err != nil {
			slog.ErrorContext(ctx, "failed to send message", "error", err)
		}
	})
	defer subscription.Unsubscribe()
	c.publish = func(topic string, v *peerspb.PeerMessagePayload, as string) error {
		slog.InfoContext(ctx, "publishing message", "topic", topic, "remotePeerId", c.remotePeerId)
		c.hub.Publish(accountId, PublishedMessage{
			topic:   topic,
			as:      as,
			payload: v,
		}, subscription.Id)
		return nil
	}
	slog.InfoContext(ctx, "client connected", "accountId", accountId, "remotePeerId", c.remotePeerId)
	if err := c.Send(ctx,
		&peerspb.PeerMessagePayload{
			Payload: &peerspb.PeerMessagePayload_Handshake{
				Handshake: &peerspb.Handshake{
					Capabilities: &peerspb.Capabilities{
						EventReconciliation: true,
						Broadcast:           true,
					},
				},
			},
		}); err != nil {
		slog.ErrorContext(ctx, "failed to send handshake", "error", err)
		return
	}
	slog.InfoContext(ctx, "sent handshake to client", "accountId", accountId, "remotePeerId", c.remotePeerId)

	for {
		typ, rawMessage, err := c.conn.Read(ctx)
		if err != nil {
			switch websocket.CloseStatus(err) {
			case websocket.StatusNormalClosure, websocket.StatusGoingAway:
				slog.InfoContext(ctx, "client disconnected", "remotePeerId", c.remotePeerId)
			default:
				slog.ErrorContext(ctx, "failed to read message", "error", err)
			}
			break
		}
		if typ != websocket.MessageBinary {
			slog.WarnContext(ctx, "received non-binary message", "type", typ)
			break
		}
		message := peerspb.PeerMessage{}
		if err := proto.Unmarshal(rawMessage, &message); err != nil {
			slog.ErrorContext(ctx, "failed to unmarshal message", "message", rawMessage, "error", err)
			continue
		}
		if message.AccountId != accountId {
			slog.WarnContext(ctx, "accountId mismatch", "expected", accountId, "got", message.AccountId)
			continue
		}
		if message.ClientId != c.remotePeerId {
			slog.WarnContext(ctx, "remotePeerId mismatch", "expected", c.remotePeerId, "got", message.ClientId)
			continue
		}
		if message.Message == nil {
			slog.WarnContext(ctx, "received nil message", "remotePeerId", c.remotePeerId)
			continue
		}
		payload, ok := message.Message.Payload.(*peerspb.PeerMessagePayload_BroadcastMessage)
		if ok {
			switch payload.BroadcastMessage.Message.(type) {
			case *peerspb.BroadcastMessage_Subscribe:
				topic := payload.BroadcastMessage.GetSubscribe().Topic
				c.subsMu.Lock()
				if _, ok := c.subscribedTo[topic]; !ok {
					c.subscribedTo[topic] = struct{}{}
				}
				c.subsMu.Unlock()
				slog.InfoContext(ctx, "client subscribed to topic", "remotePeerId", c.remotePeerId, "topic", topic)

			case *peerspb.BroadcastMessage_Publish:
				topic := payload.BroadcastMessage.GetPublish().Topic
				msg := message.Message
				if err := c.PublishAs(ctx, msg, topic, c.remotePeerId); err != nil {
					slog.ErrorContext(ctx, "failed to publish message", "remotePeerId", c.remotePeerId, "topic", topic, "message", msg, "error", err)
				}
				slog.InfoContext(ctx, "client published to topic", "remotePeerId", c.remotePeerId, "topic", topic)
			}
		}
		for _, plugin := range c.plugins {
			if err := plugin.Handle(ctx, message.Message, accountId, c.remotePeerId, c.id); err != nil {
				slog.ErrorContext(ctx, "plugin failed to handle message", "error", err)
			}
		}
	}
}

func (c *Connection) keepAlive(ctx context.Context) {
	t := time.NewTicker(wsPingInterval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			pctx, cancel := context.WithTimeout(ctx, wsPingTimeout)
			err := c.conn.Ping(pctx)
			cancel()
			if err != nil {
				c.conn.CloseNow()
				return
			}
		case <-ctx.Done():
			return
		}
	}
}
