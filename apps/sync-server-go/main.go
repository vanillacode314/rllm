package main

import (
	"log"
	"net/http"
	"os"
	client "sync-server/db"
	handlers "sync-server/server"
)

func main() {
	host := os.Getenv("HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = "8009"
	}
	db, err := client.InitDB()
	if err != nil {
		log.Fatalf("Failed to init DB: %v", err)
	}
	defer db.Close()

	router := http.NewServeMux()
	eventsHandler := handlers.EventsHandler{Db: db}
	socketsHandler := handlers.SocketHandler{Db: db, Hub: handlers.NewHub()}

	router.Handle("GET /api/v1/ws", socketsHandler)
	router.HandleFunc("GET /api/v1/messages/stream", eventsHandler.GetMessagesStream)
	router.HandleFunc("GET /api/v1/auth/requestChallenge", eventsHandler.GetRequestChallenge)
	router.HandleFunc("POST /api/v1/auth/verifyChallenge", eventsHandler.PostVerifyChallenge)
	router.HandleFunc("GET /api/v1/id", eventsHandler.GetId)
	router.HandleFunc("DELETE /api/v1/account", eventsHandler.DeleteAccount)

	s := &http.Server{Addr: host + ":" + port, Handler: corsMiddleware(router)}
	log.Printf("Started server on %s:%s", host, port)
	log.Fatal(s.ListenAndServe())
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
