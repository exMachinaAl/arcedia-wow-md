# WA-WORLD 0.6 — Self-hosted AI LLM & JSON (optional)

AI in this release **requires a local Ollama process and a model downloaded by the operator**. It never connects to OpenAI/Anthropic or a paid inference API. It is OFF by default. This is an Ollama LLM adapter, **not** a custom-trained ML model. All 24 games work without it.

## Windows setup

1. Install Ollama from https://ollama.com/download, start the local Ollama service.
2. In PowerShell/CMD, run `ollama pull llama3.2:3b` (requires internet only for model download). Choose a smaller model if your hardware needs it, and update `WA_AI_MODEL` accordingly.
3. Edit the project-root `.env` file (create it if missing). Add:

   ```dotenv
   WA_AI_ENABLED=1
   WA_AI_URL=http://127.0.0.1:11434
   WA_AI_MODEL=llama3.2:3b
   ```

4. Restart `WA-START.bat`. From a consenting *second* WhatsApp number, use:

   ```text
   .ai help
   .ai status
   .ai consent
   .ai ask Jelaskan algoritma dengan sederhana
   .ai json Apa manfaat logika pemrograman?
   .ai off
   ```

5. If Ollama is absent or model not installed, the bot responds with a recoverable warning. No external API fallback occurs.

## Privacy and limits

- Queries go from the bot directly to the *loopback* HTTP Ollama endpoint. Remote host / HTTPS URLs are rejected to avoid inadvertently transmitting prompts to outside services. Keep Ollama bound to localhost.
- Users must opt in with `.ai consent` before sending questions. `.ai off` revokes consent and deletes stored response cache for that user.
- Source stores successful response cache for idempotency, usage metadata (timestamp, user ID), and opt-in bit. **Question prompt text is NOT stored in the WA-WORLD DB**. Note: the terminal, Ollama service or operating system may have their own logs; control those separately.
- FREE: maximum 3 successful requests/minute, 25/day. PRIORITY: maximum 10/minute, 100/day. The app has no payment flow and all AI functions are available to both tiers. Up to 2 concurrent inference requests; extra requests receive a busy response and can retry.
- Maximum 500 input characters, 20-second inference timeout, 850-char text response cap, JSON fields capped. Usage is only counted after successful response; the same event key does not charge again.
- `.ai json` uses Ollama's schema-constrained `/api/generate` request (`format` schema, `stream:false`) and validates `title`, `answer`, `tags` on return. Treat outputs as untrusted; they are still model-generated.
- AI model responses can be inaccurate. **No special personal data, access keys, OTP, financial records, or confidential documents should be sent to the AI.**

## Implementation notes

- API: `src/ai/engine.js` using Node built-in `fetch`. No npm inference provider dependency.
- Schema: `ai_preferences`, `ai_calls`, `ai_replies` created with SQLite `CREATE TABLE IF NOT EXISTS`, preserving existing users, wallets, and rewards.
- `docs/QA_PLAYBOOK.md` contains required QA, and `LIVE_AI` is OPTIONAL because Ollama/GPU may not be installed yet.
- For inference quality, consider dedicated safety review, moderation and resource management before publicly inviting unknown WhatsApp users.

Related reference: https://docs.ollama.com/api/generate (official API).
