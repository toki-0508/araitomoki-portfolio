const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_fake_key');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const DB_PATH = path.join(__dirname, 'market.db');

// ミドルウェアの設定
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ========== データベース初期化 ==========
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('DB接続エラー:', err);
    } else {
        console.log('SQLiteに接続しました');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.serialize(() => {
        // ユーザーテーブル
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // 商品テーブル
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            price INTEGER NOT NULL,
            description TEXT,
            image_url TEXT,
            file_url TEXT,
            rating REAL DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // 購入履歴テーブル
        db.run(`CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            price INTEGER NOT NULL,
            purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            download_count INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);
        
        // レビューテーブル
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id),
            FOREIGN KEY(user_id) REFERENCES users(id)
        )`);
        
        // カートテーブル
        db.run(`CREATE TABLE IF NOT EXISTS cart (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER DEFAULT 1,
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);
        
        // ダミー商品データを挿入
        insertDummyProducts();
    });
}

function insertDummyProducts() {
    const products = [
        {
            title: '現代的なソファセット',
            category: 'model',
            price: 2500,
            description: '高品質な3Dモデルのソファセット。複数の色とバリエーションを含みます。'
        },
        {
            title: 'リアルなテクスチャパック',
            category: 'texture',
            price: 1500,
            description: '布、木、金属の4K テクスチャ 100枚セット'
        },
        {
            title: 'キャラクターアニメーション',
            category: 'animation',
            price: 3000,
            description: '走る、歩く、ジャンプなど基本的なアニメーション 20種類'
        },
        {
            title: 'PBRマテリアルライブラリ',
            category: 'material',
            price: 2000,
            description: '200種類のPBRマテリアル。Blender/Maya対応'
        }
    ];
    
    products.forEach(product => {
        db.run(
            'INSERT OR IGNORE INTO products (title, category, price, description, image_url) VALUES (?, ?, ?, ?, ?)',
            [product.title, product.category, product.price, product.description, '/src/images/placeholder.png'],
            (err) => {
                if (err) console.error('ダミー商品挿入エラー:', err);
            }
        );
    });
}

// ========== ミドルウェア: JWT認証 ==========
function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ message: '認証トークンが必要です' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        req.userEmail = decoded.email;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'トークンが無効です' });
    }
}

// ========== 認証エンドポイント ==========
// ユーザー登録
app.post('/api/auth/register', (req, res) => {
    const { email, password, name } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'メールアドレスとパスワードを入力してください' });
    }
    
    const hashedPassword = bcryptjs.hashSync(password, 10);
    
    db.run(
        'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
        [email, hashedPassword, name || email.split('@')[0]],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) {
                    return res.status(400).json({ message: 'このメールアドレスは既に登録されています' });
                }
                return res.status(500).json({ message: '登録エラー: ' + err.message });
            }
            
            const token = jwt.sign(
                { id: this.lastID, email },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            res.status(201).json({
                message: '登録成功',
                token,
                user: {
                    id: this.lastID,
                    email,
                    name: name || email.split('@')[0]
                }
            });
        }
    );
});

// ユーザーログイン
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({ message: 'メールアドレスとパスワードを入力してください' });
    }
    
    db.get(
        'SELECT * FROM users WHERE email = ?',
        [email],
        (err, user) => {
            if (err) {
                return res.status(500).json({ message: 'DBエラー: ' + err.message });
            }
            
            if (!user) {
                return res.status(401).json({ message: 'ログイン情報が正しくありません' });
            }
            
            const isPasswordValid = bcryptjs.compareSync(password, user.password);
            
            if (!isPasswordValid) {
                return res.status(401).json({ message: 'ログイン情報が正しくありません' });
            }
            
            const token = jwt.sign(
                { id: user.id, email: user.email },
                JWT_SECRET,
                { expiresIn: '30d' }
            );
            
            res.json({
                message: 'ログイン成功',
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name
                }
            });
        }
    );
});

// ========== 商品エンドポイント ==========
// 全商品取得
app.get('/api/products', (req, res) => {
    const { category, search, sort } = req.query;
    
    let query = 'SELECT * FROM products';
    const params = [];
    
    if (category) {
        query += ' WHERE category = ?';
        params.push(category);
    }
    
    if (search) {
        query += (category ? ' AND' : ' WHERE') + ' (title LIKE ? OR description LIKE ?)';
        params.push('%' + search + '%', '%' + search + '%');
    }
    
    if (sort === 'price-low') {
        query += ' ORDER BY price ASC';
    } else if (sort === 'price-high') {
        query += ' ORDER BY price DESC';
    } else if (sort === 'popular') {
        query += ' ORDER BY rating DESC';
    } else {
        query += ' ORDER BY created_at DESC';
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'DBエラー: ' + err.message });
        }
        res.json(rows || []);
    });
});

// 商品詳細取得
app.get('/api/products/:id', (req, res) => {
    const productId = req.params.id;
    
    db.get('SELECT * FROM products WHERE id = ?', [productId], (err, product) => {
        if (err) {
            return res.status(500).json({ message: 'DBエラー: ' + err.message });
        }
        
        if (!product) {
            return res.status(404).json({ message: '商品が見つかりません' });
        }
        
        // レビューも取得
        db.all(
            'SELECT r.*, u.name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ?',
            [productId],
            (err, reviews) => {
                product.reviews = reviews || [];
                res.json(product);
            }
        );
    });
});

// ========== 購入記録エンドポイント ==========
// 購入済み商品一覧
app.get('/api/purchases', verifyToken, (req, res) => {
    db.all(
        `SELECT p.*, pr.title, pr.image_url FROM purchases p 
         JOIN products pr ON p.product_id = pr.id 
         WHERE p.user_id = ? 
         ORDER BY p.purchase_date DESC`,
        [req.userId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: 'DBエラー: ' + err.message });
            }
            res.json(rows || []);
        }
    );
});

// 購入処理（Stripe連携）
app.post('/api/checkout', verifyToken, async (req, res) => {
    const { items, stripePaymentMethodId } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'アイテムを指定してください' });
    }
    
    try {
        // 合計金額を計算
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Stripe PaymentIntent を作成
        const paymentIntent = await stripe.paymentIntents.create({
            amount: total * 100, // Stripe は最小単位（セント/ペンス）で計算
            currency: 'jpy',
            payment_method: stripePaymentMethodId,
            confirm: true,
            metadata: {
                userId: req.userId,
                itemCount: items.length
            }
        });
        
        if (paymentIntent.status === 'succeeded') {
            // 購入記録をDBに保存
            items.forEach(item => {
                db.run(
                    'INSERT INTO purchases (user_id, product_id, price, purchase_date) VALUES (?, ?, ?, ?)',
                    [req.userId, item.id, item.price, new Date().toISOString()],
                    (err) => {
                        if (err) {
                            console.error('購入記録エラー:', err);
                        }
                    }
                );
            });
            
            res.json({
                message: '購入成功',
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status
            });
        } else {
            res.status(400).json({
                message: '決済処理に失敗しました',
                status: paymentIntent.status
            });
        }
        
    } catch (error) {
        console.error('Stripeエラー:', error);
        res.status(500).json({ 
            message: 'Stripe処理エラー: ' + error.message 
        });
    }
});

// Stripe Client Secret 取得（フロントエンド用）
app.post('/api/create-payment-intent', verifyToken, async (req, res) => {
    const { items } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'アイテムを指定してください' });
    }
    
    try {
        const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: total * 100,
            currency: 'jpy',
            metadata: {
                userId: req.userId,
                itemCount: items.length
            }
        });
        
        res.json({
            clientSecret: paymentIntent.client_secret
        });
        
    } catch (error) {
        console.error('PaymentIntent作成エラー:', error);
        res.status(500).json({ 
            message: 'PaymentIntent作成エラー: ' + error.message 
        });
    }
});

// ========== 元の購入処理（Stripe前）
app.post('/api/purchases-old', verifyToken, (req, res) => {
    const { items, stripePaymentIntentId } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ message: 'アイテムを指定してください' });
    }
    
    // 実装後：Stripe検証 + 購入記録保存
    res.status(501).json({ message: '購入機能は準備中です' });
});

// ========== レビューエンドポイント ==========
// レビュー投稿
app.post('/api/reviews', verifyToken, (req, res) => {
    const { productId, rating, comment } = req.body;
    
    if (!productId || !rating) {
        return res.status(400).json({ message: '商品IDと評価を指定してください' });
    }
    
    db.run(
        'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)',
        [productId, req.userId, rating, comment || ''],
        function(err) {
            if (err) {
                return res.status(500).json({ message: 'DBエラー: ' + err.message });
            }
            
            // 商品の平均評価を更新
            db.get(
                'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ?',
                [productId],
                (err, result) => {
                    if (result) {
                        db.run(
                            'UPDATE products SET rating = ?, review_count = ? WHERE id = ?',
                            [result.avg_rating, result.count, productId]
                        );
                    }
                    
                    res.status(201).json({
                        message: 'レビューを投稿しました',
                        review: {
                            id: this.lastID,
                            rating,
                            comment
                        }
                    });
                }
            );
        }
    );
});

// 商品のレビュー取得
app.get('/api/products/:id/reviews', (req, res) => {
    const productId = req.params.id;
    
    db.all(
        'SELECT r.*, u.name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.product_id = ?',
        [productId],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ message: 'DBエラー: ' + err.message });
            }
            res.json(rows || []);
        }
    );
});

// ========== 元のエンドポイント（互換性） ==========
app.post('/submit-idea', (req, res) => {
    const { name, email, idea } = req.body;

    if (!name || !email || !idea) {
        return res.status(400).json({ message: '全てのフィールドを入力してください。' });
    }

    console.log('新しいアイデアが送信されました:');
    console.log(`名前: ${name}`);
    console.log(`メール: ${email}`);
    console.log(`アイデア: ${idea}`);

    res.status(200).json({ message: 'アイデアを受け取りました！ありがとうございます。' });
});

// ========== ヘルスチェック ==========
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'サーバーは正常です' });
});

// ========== エラーハンドリング ==========
app.use((err, req, res, next) => {
    console.error('エラー:', err);
    res.status(500).json({ message: 'サーバーエラーが発生しました' });
});

// ========== サーバー起動 ==========
app.listen(PORT, () => {
    console.log(`サーバーが http://localhost:${PORT} で起動しました`);
});