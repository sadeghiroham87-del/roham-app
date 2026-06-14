# NIKiSUN Smart Battery Hub

A web dashboard for monitoring and managing NIKiSUN battery systems.

> **This is a prototype demo using 100% simulated data.**  
> No real hardware is required. All battery readings are generated automatically
> by the built-in simulator and refresh every 3 seconds.

---

## Quick Start

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

---

## What You Will See

| Tab | Description |
|-----|-------------|
| **Dashboard** | Live view of all batteries — charge %, voltage, current, temperature, health score. Auto-refreshes every 3 seconds. |
| **My Devices** | List of registered batteries. Use the form to register new ones. |
| **Products** | NIKiSUN product catalog with full specs and pricing. |

---

## Project Structure

```
roham-app/
├── server/
│   ├── index.js    ← Express web server and REST API routes
│   └── data.js     ← In-memory data store + battery simulator
├── public/
│   ├── index.html  ← Main HTML page (single-page app)
│   ├── app.js      ← Frontend logic (tabs, rendering, auto-refresh)
│   └── styles.css  ← All styles
├── package.json
├── .gitignore
└── README.md
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/products` | All battery models in the catalog |
| GET | `/api/devices` | All registered devices with latest readings |
| POST | `/api/devices` | Register a new device |
| GET | `/api/readings` | Latest readings for all devices |
| GET | `/api/devices/:id/readings` | Latest reading for one device |

---

## For Future Developers

This prototype uses in-memory storage — data resets when the server restarts.
When real hardware and a production environment are ready:

1. **Replace the simulator** in `server/data.js` with live BMS data via MQTT, Modbus, or HTTP.
2. **Add a real database** (PostgreSQL, MongoDB, or Supabase) to persist devices and history.
3. **Add authentication** (JWT or session-based) so only authorised users can control batteries.
4. **Build the mobile app** with Flutter or React Native — it can consume the same REST API.
5. **Add WebSockets** (e.g. Socket.io) for true real-time push instead of polling.

See the Product Requirements Document (PRD) for the full feature roadmap.

---

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** HTML + CSS + Vanilla JavaScript (no build tools)
- **Storage:** In-memory (resets on server restart)

---

*Prototype v0.1 — NIKiSUN Smart Battery Hub — June 2026*
