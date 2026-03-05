# Coin System - Design Document

## Overview

Discord上で活動するAIキャラクターが管理するコイン(通貨)システム。
銀行的な役割として各ユーザーの口座情報を管理し、AIがAPI経由で操作する。

## Architecture

```
+------------------+       REST API        +------------------+
|  AI (Discord)    | --------------------> |                  |
|  Skill + API     |   POST/GET /api/...   |   Coin Server    |
+------------------+                       |   (Hono + DB)    |
                                           |                  |
+------------------+       WebUI           |                  |
|  User (Browser)  | --------------------> |                  |
|  Discord SSO     |   GET /dashboard      +------------------+
+------------------+                              |
                                                  v
                                           +------------------+
                                           |   SQLite (DB)    |
                                           |   via Drizzle    |
                                           +------------------+
```

## Tech Stack

| Layer        | Technology                  | Reason                              |
|--------------|-----------------------------|-------------------------------------|
| Runtime      | Node.js (Bun compatible)    | 高速、モダン                         |
| Framework    | **Hono**                    | 軽量、高速、TypeScript native        |
| ORM          | **Drizzle ORM**             | Type-safe、軽量、SQLite対応          |
| Database     | **SQLite** (better-sqlite3) | ローカル完結、セットアップ不要        |
| Auth         | Discord OAuth2              | ユーザーはDiscord SSOでログイン      |
| WebUI        | Hono JSX (SSR)              | 追加フレームワーク不要、軽量         |
| Validation   | Zod                         | Schema validation                    |

## Database Schema

### accounts

| Column       | Type      | Description              |
|--------------|-----------|--------------------------|
| id           | TEXT (PK) | UUID                     |
| discord_id   | TEXT (UQ) | Discord User ID          |
| username     | TEXT      | Discord username (cache) |
| balance      | INTEGER   | 現在の保有コイン数        |
| created_at   | TEXT      | 口座作成日時              |
| updated_at   | TEXT      | 最終更新日時              |

### transactions

| Column       | Type      | Description                    |
|--------------|-----------|--------------------------------|
| id           | TEXT (PK) | UUID                           |
| account_id   | TEXT (FK) | 対象口座                        |
| type         | TEXT      | "credit" / "debit"             |
| amount       | INTEGER   | 変動額 (正の整数)               |
| balance_after| INTEGER   | 取引後の残高                    |
| reason       | TEXT      | 取引理由 (AIが記録)             |
| created_at   | TEXT      | 取引日時                        |

## API Design

### Base URL

- Default: `http://localhost:3000`
- Configurable via `HOST` / `PORT` env vars

### Authentication

- **API routes** (`/api/*`): API Key (Bearer token) - optional by default
- **WebUI routes** (`/dashboard/*`): Discord OAuth2 session

### Endpoints

#### Account Management (AI -> Server)

```
POST   /api/accounts
  Body: { discord_id: string, username?: string }
  Res:  { id, discord_id, username, balance, created_at }
  -> 口座作成 (既存なら既存を返す)

GET    /api/accounts/:discord_id
  Res:  { id, discord_id, username, balance, created_at, updated_at }
  -> 口座情報取得

GET    /api/accounts
  Query: ?limit=20&offset=0
  Res:  { accounts: [...], total: number }
  -> 全口座一覧
```

#### Coin Operations (AI -> Server)

```
POST   /api/accounts/:discord_id/credit
  Body: { amount: number, reason?: string }
  Res:  { balance, transaction }
  -> コイン付与

POST   /api/accounts/:discord_id/debit
  Body: { amount: number, reason?: string }
  Res:  { balance, transaction }
  -> コイン差引 (残高不足は400エラー)

POST   /api/accounts/:discord_id/transfer
  Body: { to_discord_id: string, amount: number, reason?: string }
  Res:  { from_balance, to_balance, transaction }
  -> 送金
```

#### Transaction History

```
GET    /api/accounts/:discord_id/transactions
  Query: ?limit=20&offset=0
  Res:  { transactions: [...], total: number }
  -> 取引履歴
```

#### System

```
GET    /api/health
  Res:  { status: "ok", version: string }
```

### WebUI Routes (User -> Server)

```
GET    /auth/discord          -> Discord OAuth2 開始
GET    /auth/discord/callback -> OAuth2 コールバック
GET    /auth/logout           -> ログアウト

GET    /dashboard             -> マイページ (残高、取引履歴)
```

## Configuration

### Environment Variables (.env)

```bash
# Server
HOST=localhost        # バインドアドレス
PORT=3000             # ポート番号

# Security (optional - 未設定ならAPI Key不要)
API_KEY=              # 設定すると全API routeで Bearer token 必須

# Discord OAuth2 (WebUI使用時のみ必要)
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=http://localhost:3000/auth/discord/callback

# Session
SESSION_SECRET=change-me-in-production

# Database
DATABASE_PATH=./data/coin.db
```

## Project Structure

```
coin/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment config
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema definitions
│   │   ├── index.ts          # DB connection
│   │   └── migrate.ts        # Migration runner
│   ├── routes/
│   │   ├── api.ts            # API routes (/api/*)
│   │   ├── auth.ts           # Discord OAuth2 routes
│   │   └── dashboard.ts      # WebUI routes
│   ├── middleware/
│   │   ├── apiKey.ts         # API Key validation
│   │   └── session.ts        # Session management
│   └── views/
│       ├── layout.tsx        # Base HTML layout
│       └── dashboard.tsx     # Dashboard page
├── drizzle/
│   └── migrations/           # Generated migrations
├── data/                     # SQLite DB file
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
└── DESIGN.md
```

## Error Response Format

```json
{
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "残高が不足しています (現在: 50, 必要: 100)"
  }
}
```

### Error Codes

| Code                  | HTTP | Description          |
|-----------------------|------|----------------------|
| ACCOUNT_NOT_FOUND     | 404  | 口座が存在しない      |
| INSUFFICIENT_BALANCE  | 400  | 残高不足              |
| INVALID_AMOUNT        | 400  | 不正な金額            |
| UNAUTHORIZED          | 401  | API Key不正           |
| VALIDATION_ERROR      | 400  | リクエスト不正         |

## Security Notes

- Default (localhost): API Key不要で動作 -> ローカル開発・AI連携に便利
- `API_KEY` を設定すると全 `/api/*` ルートで `Authorization: Bearer <key>` が必須
- Discord OAuth2は WebUI 利用時のみ必要
- SQLiteファイルは `data/` ディレクトリに配置、gitignoreで除外

## Future Extensions (Not in v1)

- レート制限
- 複数通貨対応
- ランキング API
- WebSocket リアルタイム通知
- 管理者ダッシュボード
