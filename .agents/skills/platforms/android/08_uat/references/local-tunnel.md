# Local Dev Server & Tunnel Reference for UAT

Use this reference when the stakeholder or developer selects **Option 3: Local Dev Server / Tunnel** for rapid local verification.

---

## 1. Local Dev Server Execution

1. Start the project's local development server:
   ```bash
   npm run dev
   # or
   npx vite --host
   ```
2. Confirm the listening port (e.g., `http://localhost:5173` or `http://localhost:3000`).
3. For mobile testing on the same Wi-Fi network:
   - Use the `--host` flag to bind to `0.0.0.0`.
   - Point the mobile device browser to the local network IP (e.g., `http://192.168.1.100:5173`).

---

## 2. Public HTTPS Tunnel (For Remote Stakeholder Access or HTTPS APIs)

When camera, WebAuthn, location, or remote stakeholder review requires an HTTPS URL from a local instance:

### Option A: Cloudflare Tunnel (Zero-config, free, no login required)
```bash
npx untun@latest tunnel http://localhost:5173
# or
cloudflared tunnel --url http://localhost:5173
```
- Share the temporary `*.trycloudflare.com` URL with the stakeholder.

### Option B: Ngrok
```bash
ngrok http 5173
```

---

## 3. Checklist Recording
Record in `docs/10_UAT_CHECKLIST.md`:
- **Environment:** Local Dev Server (`localhost:<port>`) or Public Tunnel (`<tunnel-url>`)
- **Limitation:** Ephemeral session, depends on host machine remaining active.
