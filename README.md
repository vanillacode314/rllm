# RLLM
> A local first LLM chat UI with end to end encrypted syncing between devices.

> There is a demo available, currently it has syncing/account enabled but it will be disabled later when all testing is done.
> [Demo Link](https://llm.raqueeb.com)

## Screenshots
Coming Soon…

Use [Demo Link](https://llm.raqueeb.com) for now

## Features
- [x] Local first. Access your chat history offline. Use LLMs even if your web server is down but your LLM provider is up.
- [x] End to end encrypted syncing between devices
- [x] Use any provider that has an openai chat completions API compatible endpoint (Openrouter, llama-server, ollama, vllm, etc...)
- [x] MCP Tools Support
- [x] Client side RAG for PDF/EPUB files
- [x] Image input support
- [x] Cors Proxy Support for MCP servers and LLM providers that don't set CORS headers correctly
- [x] Easy Install with Docker Compose

## Roadmap
- [ ] Settings - system prompt, temperature etc…
- [ ] Presets - Save/Load settings, enabled MCP tools, provider and model as a named preset
- [ ] MCP Resources / Prompts
- [ ] Rewrite Sync Server in Rust or Go

## Installation

### docker-compose
1. clone this repo

```sh
git clone https://github.com/vanillacode314/rllm
```

2. *(optional: if you want syncing support)* uncomment `sync-server` and `database` in `docker-compose.yml` and copy `env.example` to `.env`

```sh
cp env.example .env
```

3. *(optional: if you want cors proxy)* uncomment `go-cors-proxy` in `docker-compose.yml`
4. run docker compose

```sh
docker-compose up -d --build
```

4. Open [http://localhost:9870](http://localhost:9870) in your browser

## Motivation
I used to self host openwebui and librechat on my laptop, it bothered me that I couldn't access chat history on my mobile when my laptop was off or that I couldn't use external providers that were up even when my laptop was off.

## Author

👤 **Raqueebuddin Aziz (vanillacode314)**
> I freelance as a web app developer. Reach out if you like my work :)

* Website: https://raqueeb.com
* Github: [@vanillacode314](https://github.com/vanillacode314)

## Show your support

Give a ⭐️ if you like the project

## 📝 License

This project is [GPL-3.0](https://github.com/vanillacode314/rllm/blob/main/LICENSE) licensed.
