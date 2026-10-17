# WA-WORLD v0.3.1 — Native Button Verification Protocol

**Why v0.3.0 buttons were mostly invisible:** `relayMessage` sent a protobuf but did not include `additionalNodes` required for some native WhatsApp renderers. The older payload was also enclosed by `viewOnceMessage`. v0.3.1 injects `biz > interactive > native_flow` metadata and a `bot` stanza for private chats, and sends native messages without the view-once wrapper. This is an interoperability experiment, NOT a guarantee or an official API.

**Distinguish the three results:**
- **Relay accepted**: Baileys did not throw. This is *not* evidence UI buttons appeared.
- **Rendered**: The recipient actually sees three tappable quick replies inside the WhatsApp app. Report manually using `.buttoncheck native shown` / `.buttoncheck native hidden`.
- **Clicked**: After pressing a genuine reply button, bot receives a `native-button` response and records `button_click`. A typed `.tap 1` is fallback text, NOT a button click.

## Connect and test

1. Stop all WA-WORLD processes before merging; manually back up the `data` directory, which remains local.
2. Install v0.3.1 patch using the offline updater. Run `npm install` if dependencies are missing; then `npm test`.
3. Run `WA-START.bat`; connect your WhatsApp account through linked devices if not connected already. Never share the QR or `data/wa-auth`.
4. From a second, consenting WhatsApp account, start a private chat, send `.ping`, `.menu`, then `.buttons native`.
5. Inspect the *same message* for three actual native buttons. The text commands `.tap 1/2/3` appear in the body as a permanent fallback.
6. If the buttons appear, send `.buttoncheck native shown`, then click Games. The response `.games` should be processed by the bot; test `.buttoncheck native clicked`.
7. If buttons are not visible, send `.buttoncheck native hidden`, then try `.buttons legacy` and record the result as `.buttoncheck legacy hidden` or `shown`.
8. Test WhatsApp Android, iOS and Web separately where possible. Newer WhatsApp updates can change rendering.
9. Dashboard `http://127.0.0.1:3000` shows `relayed (unverified)` counts and self-reported feedback. **It never claims confirmed rendering just because relay succeeded.**
10. A reliable long-term route for officially supported interactive buttons is Meta WhatsApp Business Platform; that requires separate setup and follows the official API rules/pricing.

### Example test report

```
WA-WORLD: 0.3.1
WhatsApp client: Android / iOS / Web
.buttons native: text visible? yes/no
Three clickable WhatsApp buttons? yes/no
When clicking Games: did bot reply? yes/no
.buttons legacy: clickable? yes/no
Terminal output (hide phone numbers, QR and auth): ...
```

## Security

Baileys is not an official Meta integration. Test on your own account with willing recipients, never for unsolicited/bulk messages, and protect local credentials. No session files or phone numbers are required for debugging the patch. If native-flow buttons remain invisible, do not use a "fake button" simulation and do not promise success; use `.tap` text commands until you select an authorized supported transport.
