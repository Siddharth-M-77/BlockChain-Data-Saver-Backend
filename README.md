# 🧱 Local Blockchain Indexer (ESM + Cron + MongoDB)

This project indexes your local Ethereum/Geth network blocks & transactions into MongoDB, and provides a REST API for searches.

---

## 🚀 Features

- ✅ ESM (type: module)
- ⏰ Cron-based block indexing
- 💾 MongoDB data persistence
- 🔍 Search by tx hash, address, or block
- 🧱 Block metadata storage
- 🧩 PM2 support for production
- 🪵 Winston logging system

---

## ⚙️ Setup

```bash
npm install
cp .env.example .env
# Update .env values (MongoDB, RPC URLs)
```
