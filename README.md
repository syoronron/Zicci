# Zicci

飲食チェーンのアルバイト採用で、面接日程の調整を効率化するWebアプリです。
店舗のシフト表から面接可能な時間を自動で作り、応募者は公開ページから面接日時を予約できます。

## 技術構成

| 役割 | 技術 |
|---|---|
| 画面・サーバー | Next.js 16（App Router）＋ TypeScript |
| デザイン | Tailwind CSS 4 |
| データベース | Supabase（PostgreSQL）※無料プラン |
| 公開 | Vercel ※無料プラン（Hobby） |
| シフト画像の読み取り | Claude API（P3で導入予定・任意） |

## フォルダ構成

```
src/app/                  画面（ページ）
src/lib/supabase/         データベース接続
supabase/migrations/      データベースの設計図（テーブル定義）
supabase/seed.sql         デモ用データ
```

## セットアップ手順

### 1. Supabase（データベース）を用意する

1. https://supabase.com で無料アカウントを作り、「New project」でプロジェクトを作成します
   - Region は **Northeast Asia (Tokyo)** を選びます
   - Database Password は控えておきます（今回のアプリでは使いませんが、管理用に必要です）
2. 左メニューの **SQL Editor** を開き、次の2つを順番に貼り付けて「Run」を押します
   1. `supabase/migrations/20261117000000_init.sql`（テーブル作成）
   2. `supabase/seed.sql`（デモ店舗データ）
3. **Project Settings** から次の2つを控えます
   - **Data API → Project URL** … `SUPABASE_URL`
   - **API Keys → Secret key**（`sb_secret_` で始まるもの）… `SUPABASE_SECRET_KEY`
     （画面が古い場合は `service_role` キーでも動きます）

> ⚠️ Secret key は「何でもできる鍵」です。GitHub やチャットに貼らないでください。

### 2. 手元で動かす（任意）

```bash
cp .env.example .env.local   # 作成した .env.local に上の2つの値を書く
npm install
npm run dev                  # http://localhost:3000 を開く
```

トップページ下部の「システムの状態」が **データベース接続OK** になれば成功です。

### 3. Vercel で公開する

1. https://vercel.com で GitHub アカウントを使って無料登録します
2. 「Add New… → Project」で `Zicci` リポジトリを選んで Import します
3. **Environment Variables** に `SUPABASE_URL` と `SUPABASE_SECRET_KEY` を追加します
4. 「Deploy」を押すと公開URLが発行されます

## 開発の進め方

| フェーズ | 内容 | 状態 |
|---|---|---|
| P0 | 初期設定・テーブル作成・公開 | ✅ |
| P1 | 店舗設定・シフト手入力・面接枠の自動生成 | |
| P2 | 応募者の予約ページ・予約一覧 | |
| P3 | シフト画像のAI読み取り（任意） | |
| P4 | ログイン・店舗ごとのデータ分離 | |

## セキュリティの方針

- すべてのテーブルで RLS（行レベルセキュリティ）を有効にしています。ポリシーを作っていないため、ブラウザから直接データベースを読み書きすることはできません
- データベースの操作は、すべてサーバー側（Secret key を持つ Next.js のサーバー処理）で行います
- 重複予約は、データベースの制約で防いでいます
  - `reservations.slot_id` を UNIQUE にしているので、1つの枠に予約は1件までしか入りません
  - `interview_slots` に EXCLUDE 制約をかけているので、同じ店舗で時間が重なる枠は作れません
