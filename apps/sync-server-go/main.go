package main

import (
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"pubsub"
	"sync-server/db"
	"sync-server/server"
	"sync-server/server/socket"
)

func main() {
	host, port, dbUri, dbAuthToken, err := parseEnv()
	if err != nil {
		log.Fatalf("failed to parse env: %v", err)
	}

	db, err := db.NewClient(dbUri, dbAuthToken)
	if err != nil {
		log.Fatalf("failed to init DB: %v", err)
	}
	defer db.Close()

	hub := pubsub.NewHub[socket.PublishedMessage]()
	router := http.NewServeMux()
	attachRestHandler(router, db)
	attachSocketHandler(router, db, hub)

	s := &http.Server{Addr: net.JoinHostPort(host, port), Handler: corsMiddleware(router)}
	log.Printf("Started server on %s:%s", host, port)
	log.Fatal(s.ListenAndServe())
}

func attachRestHandler(router *http.ServeMux, db *db.DbClient) {
	restHandler := rest.RESTHandler{Db: db}
	router.HandleFunc("GET /api/v1/messages/stream", restHandler.GetMessagesStream)
	router.HandleFunc("GET /api/v1/auth/requestChallenge", restHandler.GetRequestChallenge)
	router.HandleFunc("POST /api/v1/auth/verifyChallenge", restHandler.PostVerifyChallenge)
	router.HandleFunc("GET /api/v1/id", restHandler.GetId)
	router.HandleFunc("DELETE /api/v1/account", restHandler.DeleteAccount)

}

func attachSocketHandler(router *http.ServeMux, db *db.DbClient, hub *pubsub.Hub[socket.PublishedMessage]) {
	router.HandleFunc("GET /api/v1/ws", func(w http.ResponseWriter, r *http.Request) {
		conn := socket.NewConnection(db, hub, socket.NewEventReconciliationPlugin(db))
		conn.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func parseEnv() (string, string, string, string, error) {
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8009"
	}
	dbUri := os.Getenv("DATABASE_CONNECTION_URL")
	if dbUri == "" {
		return "", "", "", "", fmt.Errorf("DATABASE_CONNECTION_URL is required")
	}
	dbAuthToken := os.Getenv("DATABASE_AUTH_TOKEN")
	return host, port, dbUri, dbAuthToken, nil
}
