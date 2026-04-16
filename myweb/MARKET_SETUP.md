# マーケットプレイス - セットアップガイド

3Dデータ販売用のマーケットプレイスシステムです。Stripe決済、ユーザー認証、レビュー機能を備えています。

## 📋 機能一覧

- ✅ ユーザー認証（登録・ログイン）
- ✅ 商品管理（表示・検索・フィルタ）
- ✅ ショッピングカート機能
- ✅ レビュー・評価システム
- ✅ 購入履歴管理
- ✅ Stripe決済統合
- ✅ ダウンロード管理

## 🚀 クイックスタート

### 1. ローカル環境でのセットアップ

```bash
# バックエンドのセットアップ
cd portfolio-backend
npm install

# .env ファイルを設定
# Stripeキーを取得: https://dashboard.stripe.com/
```

### 2. 環境変数の設定 (.env)

```env
PORT=3000
JWT_SECRET=your_random_secret_key_here
STRIPE_SECRET_KEY=sk_test_your_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_key
DATABASE_URL=./market.db
NODE_ENV=development
```

### 3. サーバーの起動

```bash
cd portfolio-backend
npm install
node server.js
```

サーバーが `http://localhost:3000` で起動します。

### 4. ブラウザでアクセス

```
http://localhost:3000/../public/market.html
```

## 📚 API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン

### 商品
- `GET /api/products` - 商品一覧取得
- `GET /api/products/:id` - 商品詳細取得

### 購入
- `POST /api/create-payment-intent` - 決済用ClientSecret取得
- `POST /api/checkout` - 決済実行

### レビュー
- `POST /api/reviews` - レビュー投稿
- `GET /api/products/:id/reviews` - レビュー一覧

### 購入履歴
- `GET /api/purchases` - 購入履歴取得

## 🔑 Stripe セットアップ

1. [Stripe Dashboard](https://dashboard.stripe.com/) にアクセス
2. Test APIキーを取得
3. `.env` ファイルに設定
4. フロントエンドにも `STRIPE_PUBLISHABLE_KEY` を設定

### テストカード情報

決済テスト用：
- カード番号: `4242 4242 4242 4242`
- 有効期限: `12/25`
- CVC: `123`

## 📁 ファイル構成

```
portfolio-backend/
├── server.js           # メインサーバーファイル
├── market.db          # SQLiteデータベース（自動生成）
├── package.json       # npm依存関係
└── .env              # 環境変数

public/
├── market.html        # マーケットページHTML

src/
├── market.js         # マーケットロジック（フロントエンド）
└── market.css        # マーケットスタイル
```

## 🗄️ データベース構成

### users テーブル
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    created_at DATETIME
);
```

### products テーブル
```sql
CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    title TEXT,
    category TEXT,
    price INTEGER,
    description TEXT,
    image_url TEXT,
    file_url TEXT,
    rating REAL,
    review_count INTEGER
);
```

### purchases テーブル
```sql
CREATE TABLE purchases (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    product_id INTEGER,
    price INTEGER,
    purchase_date DATETIME,
    download_count INTEGER
);
```

### reviews テーブル
```sql
CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    product_id INTEGER,
    user_id INTEGER,
    rating INTEGER,
    comment TEXT,
    created_at DATETIME
);
```

## 🔐 認証

JWT（JSON Web Token）を使用した認証を実装しています。

- トークンの有効期限: 30日
- ローカルストレージに保存
- APIリクエストのヘッダーに含める

```javascript
// ヘッダー例
Authorization: Bearer your_jwt_token_here
```

## ⚙️ 商品の追加・編集

現在、ダミー商品がDBに自動挿入されます。新規商品の実装時には、管理画面を追加してください。

```javascript
// DB直接:
INSERT INTO products (title, category, price, description, image_url, file_url) 
VALUES ('商品名', 'model', 2500, '説明', 'image.png', 'file.zip');
```

## 📝 トラブルシューティング

### DBエラーが出る場合
```bash
# market.db を削除して再生成
rm portfolio-backend/market.db
node portfolio-backend/server.js
```

### Stripeキーエラー
- `.env` ファイルが存在することを確認
- キーがテストキーであることを確認

### CORSエラー
- `market.html` が `http://localhost` で実行されていることを確認

## 🛠️ 今後の実装予定

- [ ] 管理画面（商品CRUD）
- [ ] ダウンロードリンク生成
- [ ] メール通知
- [ ] 決済キャンセル処理
- [ ] リファンド処理
- [ ] 複数言語対応
- [ ] モバイルアプリ

## 📧 サポート

問題が発生した場合や質問がある場合は、GitHubのissueを作成してください。

---

**作成日**: 2025年  
**ライセンス**: ISC
