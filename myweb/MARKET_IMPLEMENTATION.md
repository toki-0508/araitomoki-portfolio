# 🚀 マーケットプレイス実行ガイド

3Dデータ販売マーケットプレイスの完全な実装が完了しました！

## 📦 実装内容

### ✅ フロントエンド
- **市場ページ** (`/public/market.html`)
  - マーケット管理画面
  - 商品表示・検索・フィルタ
  - ショッピングカート機能
  - Stripe決済UI
  - レビュー・評価システム
  - 購入履歴表示

- **スタイル** (`/src/market.css`)
  - モダンなデザイン
  - レスポンシブ対応
  - アニメーション効果

- **ロジック** (`/src/market.js`)
  - SKバックエンドAPI連携
  - ユーザー認証
  - カート管理
  - レビュー投稿

- **Stripe決済** (`/src/stripe-payment.js`)
  - カード入力フォーム
  - 決済処理
  - エラーハンドリング

### ✅ バックエンド
- **Express.jsサーバー** (`/portfolio-backend/server.js`)
  - SQLiteデータベース
  - JWT認証
  - RESTful API
  - Stripe統合

- **API エンドポイント**
  - ユーザー認証（登録・ログイン）
  - 商品管理（取得・検索）
  - 購入処理（Stripe決済）
  - レビュー管理
  - 購入履歴取得

## 🛠️ セットアップ手順

### ステップ1: 必要なパッケージをインストール

```bash
cd /Users/toki/myweb/portfolio-backend
npm install
```

### ステップ2: 環境変数を設定

`.env` ファイルを編集して、Stripeキーを設定します：

```bash
# 1. Stripe Dashboard にアクセス
# https://dashboard.stripe.com/

# 2. Test API キーを取得
# - Secret Key (sk_test_...)
# - Publishable Key (pk_test_...)

# 3. .env ファイルを編集
PORT=3000
JWT_SECRET=your_super_secret_jwt_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
DATABASE_URL=./market.db
NODE_ENV=development
```

### ステップ3: Stripeキーをフロントエンドに設定

`/src/stripe-payment.js` の以下の行を更新：

```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_your_key_here';
```

### ステップ4: サーバーを起動

```bash
cd /Users/toki/myweb/portfolio-backend
node server.js
```

出力例：
```
SQLiteに接続しました
サーバーが http://localhost:3000 で起動しました
```

### ステップ5: ブラウザでアクセス

```
http://localhost:3000/../public/market.html
```

または、ローカルサーバーを立てて：
```
http://localhost:8000/public/market.html
```

## 🧪 テスト手順

### 1. ユーザー登録・ログイン
1. ページの「ログイン」ボタンをクリック
2. メールアドレスとパスワードを入力
3. 初回は自動で登録されます

テスト用：
- メール: `test@example.com`
- パスワード: `password123`

### 2. 商品の閲覧
1. ダミー商品が自動で表示されます
2. 検索・カテゴリフィルタで試す
3. 商品をクリックして詳細表示

### 3. レビュー投稿
1. 商品詳細でレビューを投稿（ログイン必須）
2. 評価（1-5つ星）とコメントを入力
3. 投稿後に反映確認

### 4. カート・支払い
1. 商品をカートに追加
2. カートアイコンでカート確認
3. チェックアウトボタンをクリック
4. Stripe支払いフォームが表示
5. **テストカード情報を入力**：
   - カード番号: `4242 4242 4242 4242`
   - 有効期限: `12/25`
   - CVC: `123`
   - 名前: 任意

### 5. 購入履歴確認
1. ログイン状態で「購入済みデータ」セクション表示
2. 支払い完了後に購入記録が表示

## 📊 データベース構成

自動生成されるテーブル：

```
users          - ユーザー情報（メール、パスワード等）
products       - 商品情報（価格、カテゴリ、説明等）
purchases      - 購入記録（ユーザーID、商品ID、料金等）
reviews        - レビュー・評価（コメント、評価値等）
cart           - カート（ユーザーID、商品ID、数量）
```

## 🔒 セキュリティ考慮事項

本番環境では以下を実装してください：

- [ ] HTTPS使用（SSL/TLS）
- [ ] JWT_SECRET を強力なランダム文字列に変更
- [ ] DBをサーバーから安全に管理
- [ ] CORS設定の制限
- [ ] レート制限の実装
- [ ] 入力値の検証・サニタイズ
- [ ] パスワード最小文字数の指定
- [ ] 2要素認証（2FA）
- [ ] エラーメッセージの詳細化制限

## 🚀 本番環境へのデプロイ

### ホスティング候補

#### バックエンド
- Heroku
- Railway
- Vercel (Serverless)
- AWS EC2/Lightsail
- DigitalOcean

#### DB
- PostgreSQL（推奨）
- MongoDB Atlas
- AWS RDS

#### フロントエンド
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront

### デプロイ時の設定

```bash
# 環境変数を本番用に更新
NODE_ENV=production
JWT_SECRET=production_secret_key
STRIPE_SECRET_KEY=sk_live_...
DATABASE_URL=production_db_url

# ビルド
npm install --production
node server.js
```

## 📝 用語集

- **JWT (JSON Web Token)**: ユーザー認証用トークン
- **Stripe**: オンライン決済プロバイダー
- **SQLite**: 軽量なローカルDB
- **CORS**: クロスオリジン・リソース・シェアリング
- **REST API**: Webサービス設計パターン

## 🐛 トラブルシューティング

### DBエラーが出る場合
```bash
# market.db が壊れた場合
rm portfolio-backend/market.db

# サーバーを再起動（DBが自動再生成）
node portfolio-backend/server.js
```

### Stripeエラー
- キーが正しく `.env` に設定されているか確認
- キーがテストキー（sk_test_）であることを確認
- ブラウザのコンソールでエラーを確認

### CORSエラー
- バックエンドの CORS設定を確認
- フロントエンド・バックエンドが同じ origin で実行されているか確認

### ページが表示されない
- サーバーが起動しているか確認
- ポート 3000 が空いているか確認
- ブラウザのコンソール（F12）でエラーを確認

## 📧 今後の改善案

- [ ] 複数言語対応
- [ ] ユーザープロフィール機能
- [ ] ウィッシュリスト
- [ ] 高度な検索フィルタ
- [ ] 販売数ランキング
- [ ] 出品者管理画面
- [ ] メール通知
- [ ] SMS通知
- [ ] Apple Pay/Google Pay対応
- [ ] サブスクリプション売上
- [ ] アフィリエイトプログラム

---

🎉 **マーケットプレイスの構築完了！**

質問や問題があれば、ドキュメントを参照するか、GitHubのIssueで報告してください。
