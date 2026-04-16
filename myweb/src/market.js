// マーケットページのメインロジック
// バックエンドAPI統合版

const API_BASE_URL = 'http://localhost:3000/api';

// 状態管理
const state = {
    currentUser: null,
    cart: [],
    products: [],
    currentProduct: null,
    isPermanentLoggedIn: false
};

// ローカルストレージキー
const STORAGE_KEYS = {
    USER_TOKEN: 'market_user_token',
    CART: 'market_cart',
    USER_DATA: 'market_user_data'
};

// ========== 初期化 ==========
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // 既存セッションを確認
    checkExistingSession();
    
    // イベントリスナーを設定
    setupEventListeners();
    
    // 商品データを読み込み
    loadProducts();
    
    // カートをローカルストレージから復元
    loadCartFromStorage();
    
    // カウントを更新
    updateCartUI();
}

function checkExistingSession() {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        
        if (token && userData) {
            state.currentUser = JSON.parse(userData);
            state.isPermanentLoggedIn = true;
            updateAuthUI();
            loadPurchases();
        }
    } catch (error) {
        console.error('セッション復元エラー:', error);
        localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
}

// ========== イベントリスナー設定 ==========
function setupEventListeners() {
    // 認証ボタン
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const authForm = document.getElementById('authForm');
    const authModal = document.getElementById('authModal');
    
    authBtn.addEventListener('click', showAuthModal);
    logoutBtn?.addEventListener('click', logout);
    closeAuthBtn.addEventListener('click', closeAuthModal);
    authForm.addEventListener('submit', handleAuthSubmit);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });
    
    // 検索・フィルタ
    document.getElementById('searchBtn').addEventListener('click', filterProducts);
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('sortFilter').addEventListener('change', filterProducts);
    
    // カート
    document.getElementById('cartBtn').addEventListener('click', showCartModal);
    document.getElementById('closeCartBtn').addEventListener('click', closeCartModal);
    document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);
    
    // 商品モーダル
    document.getElementById('closeProductBtn').addEventListener('click', closeProductModal);
    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
    
    // レビュー投稿
    document.getElementById('submitReviewBtn')?.addEventListener('click', submitReview);
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('productModal')) {
            closeProductModal();
        }
    });
}

// ========== 認証関連 ==========
function showAuthModal() {
    document.getElementById('authModal').classList.add('active');
    document.getElementById('authForm').reset();
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authError').textContent = '';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorDiv = document.getElementById('authError');
    const submitBtn = document.getElementById('authSubmitBtn');
    
    try {
        if (!email || !password) {
            throw new Error('メールアドレスとパスワードを入力してください');
        }
        
        submitBtn.disabled = true;
        submitBtn.textContent = '処理中...';
        
        // サーバーにログイン/登録リクエストを送信
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        let data = await response.json();
        
        // ログイン失敗時は登録を試みる
        if (!response.ok) {
            if (response.status === 401) {
                const registerResponse = await fetch(`${API_BASE_URL}/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        email, 
                        password,
                        name: email.split('@')[0]
                    })
                });
                
                if (!registerResponse.ok) {
                    const errorData = await registerResponse.json();
                    throw new Error(errorData.message || '登録に失敗しました');
                }
                
                data = await registerResponse.json();
            } else {
                throw new Error(data.message || 'ログインに失敗しました');
            }
        }
        
        // ユーザー情報をローカルストレージに保存
        state.currentUser = data.user;
        localStorage.setItem(STORAGE_KEYS.USER_TOKEN, data.token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(data.user));
        
        state.isPermanentLoggedIn = true;
        closeAuthModal();
        updateAuthUI();
        loadPurchases();
        
        // 成功メッセージ
        showNotification('ログイン/登録成功', 'success');
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ログイン';
    }
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    
    state.currentUser = null;
    state.isPermanentLoggedIn = false;
    state.cart = [];
    localStorage.removeItem(STORAGE_KEYS.CART);
    
    updateAuthUI();
    closePurchases();
    updateCartUI();
    
    showNotification('ログアウトしました', 'success');
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    
    if (state.currentUser) {
        authBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = state.currentUser.name || state.currentUser.email;
    } else {
        authBtn.style.display = 'inline-block';
        userInfo.style.display = 'none';
    }
}

// ========== 商品管理 ==========
async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        
        if (!response.ok) {
            throw new Error('商品の読み込みに失敗しました');
        }
        
        state.products = await response.json();
        displayProducts(state.products);
        
    } catch (error) {
        console.error('商品読み込みエラー:', error);
        showNotification('商品の読み込みに失敗しました: ' + error.message, 'error');
    }
}

function displayProducts(products) {
    const grid = document.getElementById('productsGrid');
    
    if (products.length === 0) {
        grid.innerHTML = '<div class="loading">商品が見つかりません</div>';
        return;
    }
    
    grid.innerHTML = products.map(product => `
        <div class="product-card" onclick="showProductModal(${product.id})">
            <div class="product-image-container">
                <img src="${product.image_url || '/src/images/placeholder.png'}" alt="${product.title}" onerror="this.src='/src/images/placeholder.png'">
            </div>
            <div class="product-card-body">
                <h3 class="product-card-title">${product.title}</h3>
                <div class="product-card-meta">
                    <span class="product-category">${getCategoryLabel(product.category)}</span>
                    <span class="product-rating">${product.rating ? product.rating.toFixed(1) : '-'}⭐</span>
                </div>
                <div class="product-card-price">¥${product.price.toLocaleString()}</div>
                <div class="product-card-buttons">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); addToCartQuick(${product.id})">
                        カートに追加
                    </button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); showProductModal(${product.id})">
                        詳細
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

async function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortFilter').value;
    
    try {
        const params = new URLSearchParams();
        if (searchTerm) params.append('search', searchTerm);
        if (category) params.append('category', category);
        if (sortBy) params.append('sort', sortBy);
        
        const response = await fetch(`${API_BASE_URL}/products?${params}`);
        
        if (!response.ok) {
            throw new Error('フィルタ処理に失敗しました');
        }
        
        const filtered = await response.json();
        displayProducts(filtered);
        
    } catch (error) {
        console.error('フィルタエラー:', error);
        showNotification('フィルタ処理に失敗しました', 'error');
    }
}

function getCategoryLabel(category) {
    const labels = {
        'model': '3Dモデル',
        'texture': 'テクスチャ',
        'material': 'マテリアル',
        'animation': 'アニメーション',
        'other': 'その他'
    };
    return labels[category] || category;
}

async function showProductModal(productId) {
    try {
        const response = await fetch(`${API_BASE_URL}/products/${productId}`);
        
        if (!response.ok) {
            throw new Error('商品の詳細取得に失敗しました');
        }
        
        state.currentProduct = await response.json();
        
        document.getElementById('productTitle').textContent = state.currentProduct.title;
        document.getElementById('productImage').src = state.currentProduct.image_url || '/src/images/placeholder.png';
        document.getElementById('productPrice').textContent = state.currentProduct.price.toLocaleString();
        document.getElementById('productCategory').textContent = getCategoryLabel(state.currentProduct.category);
        document.getElementById('productDescription').textContent = state.currentProduct.description;
        document.getElementById('productRating').textContent = state.currentProduct.rating ? state.currentProduct.rating.toFixed(1) : '-';
        
        // レビューを表示
        displayReviews(state.currentProduct.reviews || []);
        
        // ユーザーがログインしている場合はレビューフォームを表示
        const reviewForm = document.getElementById('reviewForm');
        if (state.currentUser) {
            reviewForm.style.display = 'block';
        } else {
            reviewForm.style.display = 'none';
        }
        
        document.getElementById('productModal').classList.add('active');
        
    } catch (error) {
        console.error('商品詳細取得エラー:', error);
        showNotification('商品情報の取得に失敗しました', 'error');
    }
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    state.currentProduct = null;
}

// ========== カート管理 ==========
function addToCartQuick(productId) {
    addProductToCart(productId);
    updateCartUI();
    
    // 簡単な通知
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'カートに追加しました！';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, 2000);
}

function addToCart() {
    if (state.currentProduct) {
        addProductToCart(state.currentProduct.id);
        updateCartUI();
        closeProductModal();
        
        // 成功メッセージ
        showNotification('商品をカートに追加しました', 'success');
    }
}

function addProductToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    
    if (!product) return;
    
    const existingItem = state.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            ...product,
            quantity: 1
        });
    }
    
    saveCartToStorage();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCartToStorage();
    updateCartUI();
    displayCartItems();
}

function updateQuantity(productId, newQuantity) {
    const item = state.cart.find(item => item.id === productId);
    
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartUI();
            displayCartItems();
        }
    }
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const total = calculateCartTotal();
    
    cartCount.textContent = state.cart.length;
    cartTotal.textContent = total.toLocaleString();
    
    // チェックアウトボタンの有効化
    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = state.cart.length === 0 || !state.currentUser;
}

function calculateCartTotal() {
    return state.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function saveCartToStorage() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.CART);
        if (saved) {
            state.cart = JSON.parse(saved);
        }
    } catch (error) {
        console.error('カート復元エラー:', error);
    }
}

function showCartModal() {
    displayCartItems();
    document.getElementById('cartModal').classList.add('active');
    updateCartUI();
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    const total = calculateCartTotal();
    document.getElementById('modalCartTotal').textContent = total.toLocaleString();
    
    if (state.cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>カートは空です</p>';
        return;
    }
    
    cartItemsContainer.innerHTML = state.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">¥${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${item.id})">削除</button>
        </div>
    `).join('');
}

async function handleCheckout() {
    if (!state.currentUser) {
        showNotification('チェックアウトするにはログインしてください', 'error');
        showAuthModal();
        return;
    }
    
    if (state.cart.length === 0) {
        showNotification('カートが空です', 'error');
        return;
    }
    
    try {
        closeCartModal();
        openPaymentModal();
        
    } catch (error) {
        showNotification('チェックアウト処理エラー: ' + error.message, 'error');
    }
}

// ========== 購入履歴管理 ==========
async function loadPurchases() {
    const purchasesSection = document.getElementById('purchasesSection');
    if (!state.currentUser) {
        purchasesSection.style.display = 'none';
        return;
    }
    
    try {
        const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        const response = await fetch(`${API_BASE_URL}/purchases`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('購入履歴の取得に失敗しました');
        }
        
        const purchases = await response.json();
        purchasesSection.style.display = 'block';
        displayPurchases(purchases);
        
    } catch (error) {
        console.error('購入履歴取得エラー:', error);
        displayPurchases([]);
    }
}

function closePurchases() {
    document.getElementById('purchasesSection').style.display = 'none';
}

function displayPurchases(purchases) {
    const grid = document.getElementById('purchasesGrid');
    
    if (purchases.length === 0) {
        grid.innerHTML = '<p>購入済みのデータはありません</p>';
        return;
    }
    
    grid.innerHTML = purchases.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-title">${purchase.title}</div>
            <div class="purchase-meta">
                購入日：${new Date(purchase.purchase_date).toLocaleDateString('ja-JP')}
                <br>価格：¥${purchase.price.toLocaleString()}
            </div>
            <button class="download-btn" onclick="downloadPurchase(${purchase.id})">ダウンロード</button>
        </div>
    `).join('');
}

function downloadPurchase(purchaseId) {
    // 実装後：購入したファイルをダウンロード
    showNotification('ダウンロード機能は準備中です', 'info');
}

// ========== レビュー管理 ==========
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    
    if (!reviews || reviews.length === 0) {
        reviewsList.innerHTML = '<p>まだレビューはありません</p>';
        return;
    }
    
    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <div>
                    <div class="review-author">${review.name}</div>
                    <div class="review-date">${new Date(review.created_at).toLocaleDateString('ja-JP')}</div>
                </div>
            </div>
            <div class="review-rating">${'⭐'.repeat(review.rating)}</div>
            <div class="review-comment">${review.comment}</div>
        </div>
    `).join('');
}

async function submitReview() {
    if (!state.currentProduct) return;
    
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value;
    
    if (!rating || !comment) {
        showNotification('評価とコメントを入力してください', 'error');
        return;
    }
    
    try {
        const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        const response = await fetch(`${API_BASE_URL}/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                productId: state.currentProduct.id,
                rating: parseInt(rating),
                comment: comment
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'レビュー投稿に失敗しました');
        }
        
        // レビューを再読み込み
        const productResponse = await fetch(`${API_BASE_URL}/products/${state.currentProduct.id}`);
        const updatedProduct = await productResponse.json();
        state.currentProduct = updatedProduct;
        displayReviews(state.currentProduct.reviews || []);
        
        // フォームをリセット
        document.getElementById('reviewRating').value = '';
        document.getElementById('reviewComment').value = '';
        
        showNotification('レビューを投稿しました', 'success');
        
    } catch (error) {
        showNotification('レビュー投稿エラー: ' + error.message, 'error');
    }
}

// ========== ユーティリティ ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `${type}-message show`;
    notification.textContent = message;
    
    const mainElement = document.querySelector('#market-main');
    mainElement.insertBefore(notification, mainElement.firstChild);
    
    setTimeout(() => notification.remove(), 4000);
}

function checkExistingSession() {
    try {
        const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
        
        if (token && userData) {
            state.currentUser = JSON.parse(userData);
            state.isPermanentLoggedIn = true;
            updateAuthUI();
            showPurchases();
        }
    } catch (error) {
        console.error('セッション復元エラー:', error);
        localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    }
}

// ========== イベントリスナー設定 ==========
function setupEventListeners() {
    // 認証ボタン
    const authBtn = document.getElementById('authBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeAuthBtn = document.getElementById('closeAuthBtn');
    const authForm = document.getElementById('authForm');
    const authModal = document.getElementById('authModal');
    
    authBtn.addEventListener('click', showAuthModal);
    logoutBtn?.addEventListener('click', logout);
    closeAuthBtn.addEventListener('click', closeAuthModal);
    authForm.addEventListener('submit', handleAuthSubmit);
    authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
    });
    
    // 検索・フィルタ
    document.getElementById('searchBtn').addEventListener('click', filterProducts);
    document.getElementById('categoryFilter').addEventListener('change', filterProducts);
    document.getElementById('sortFilter').addEventListener('change', filterProducts);
    
    // カート
    document.getElementById('cartBtn').addEventListener('click', showCartModal);
    document.getElementById('closeCartBtn').addEventListener('click', closeCartModal);
    document.getElementById('checkoutBtn').addEventListener('click', handleCheckout);
    
    // 商品モーダル
    document.getElementById('closeProductBtn').addEventListener('click', closeProductModal);
    document.getElementById('addToCartBtn').addEventListener('click', addToCart);
    
    // レビュー投稿
    document.getElementById('submitReviewBtn')?.addEventListener('click', submitReview);
    document.getElementById('productModal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('productModal')) {
            closeProductModal();
        }
    });
}

// ========== 認証関連 ==========
function showAuthModal() {
    document.getElementById('authModal').classList.add('active');
    document.getElementById('authForm').reset();
    document.getElementById('authError').classList.remove('show');
    document.getElementById('authError').textContent = '';
}

function closeAuthModal() {
    document.getElementById('authModal').classList.remove('active');
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errorDiv = document.getElementById('authError');
    
    try {
        // 実装後はサーバーに認証リクエストを送信
        // 現在はローカルで簡易的に実装
        
        if (!email || !password) {
            throw new Error('メールアドレスとパスワードを入力してください');
        }
        
        // ダミー認証（実装後は削除）
        state.currentUser = {
            id: 'user_' + Date.now(),
            email: email,
            name: email.split('@')[0]
        };
        
        const token = 'token_' + Date.now();
        
        // ローカルストレージに保存
        localStorage.setItem(STORAGE_KEYS.USER_TOKEN, token);
        localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(state.currentUser));
        
        state.isPermanentLoggedIn = true;
        closeAuthModal();
        updateAuthUI();
        showPurchases();
        
        // 成功メッセージ
        const successDiv = document.createElement('div');
        successDiv.textContent = 'ログインしました';
        successDiv.className = 'success-message show';
        document.querySelector('#market-main').insertBefore(
            successDiv,
            document.querySelector('#market-main').firstChild
        );
        
        setTimeout(() => successDiv.remove(), 3000);
        
    } catch (error) {
        errorDiv.textContent = error.message;
        errorDiv.classList.add('show');
    }
}

function logout() {
    localStorage.removeItem(STORAGE_KEYS.USER_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    
    state.currentUser = null;
    state.isPermanentLoggedIn = false;
    state.cart = [];
    localStorage.removeItem(STORAGE_KEYS.CART);
    
    updateAuthUI();
    closePurchases();
    updateCartUI();
    
    document.getElementById('authModal').classList.remove('active');
}

function updateAuthUI() {
    const authSection = document.getElementById('authSection');
    const authBtn = document.getElementById('authBtn');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    
    if (state.currentUser) {
        authBtn.style.display = 'none';
        userInfo.style.display = 'flex';
        userName.textContent = state.currentUser.name || state.currentUser.email;
    } else {
        authBtn.style.display = 'inline-block';
        userInfo.style.display = 'none';
    }
}

// ========== 商品管理 ==========
function loadProducts() {
    // ダミー商品データ（実装後はAPIから取得）
    state.products = [
        {
            id: 1,
            title: '現代的なソファセット',
            category: 'model',
            price: 2500,
            image: '/src/images/placeholder.png',
            description: '高品質な3Dモデルのソファセット。複数の色とバリエーションを含みます。',
            rating: 4.5,
            reviews: []
        },
        {
            id: 2,
            title: 'リアルなテクスチャパック',
            category: 'texture',
            price: 1500,
            image: '/src/images/placeholder.png',
            description: '布、木、金属の4K テクスチャ 100枚セット',
            rating: 4.0,
            reviews: []
        },
        {
            id: 3,
            title: 'キャラクターアニメーション',
            category: 'animation',
            price: 3000,
            image: '/src/images/placeholder.png',
            description: '走る、歩く、ジャンプなど基本的なアニメーション 20種類',
            rating: 4.8,
            reviews: []
        },
        {
            id: 4,
            title: 'PBRマテリアルライブラリ',
            category: 'material',
            price: 2000,
            image: '/src/images/placeholder.png',
            description: '200種類のPBRマテリアル。Blender/Maya対応',
            rating: 4.2,
            reviews: []
        },
        {
            id: 5,
            title: 'インテリアセット - モダン',
            category: 'model',
            price: 3500,
            image: '/src/images/placeholder.png',
            description: 'モダンインテリア 50個のモデルセット',
            rating: 4.6,
            reviews: []
        },
        {
            id: 6,
            title: 'ゲームキャラクターベース',
            category: 'model',
            price: 1800,
            image: '/src/images/placeholder.png',
            description: 'ゲーム用キャラクターベースモデル（リグ済み）',
            rating: 4.3,
            reviews: []
        }
    ];
    
    displayProducts(state.products);
}

function displayProducts(products) {
    const grid = document.getElementById('productsGrid');
    
    if (products.length === 0) {
        grid.innerHTML = '<div class="loading">商品が見つかりません</div>';
        return;
    }
    
    grid.innerHTML = products.map(product => `
        <div class="product-card" onclick="showProductModal(${product.id})">
            <div class="product-image-container">
                <img src="${product.image}" alt="${product.title}" onerror="this.src='/src/images/placeholder.png'">
            </div>
            <div class="product-card-body">
                <h3 class="product-card-title">${product.title}</h3>
                <div class="product-card-meta">
                    <span class="product-category">${getCategoryLabel(product.category)}</span>
                    <span class="product-rating">${product.rating}⭐</span>
                </div>
                <div class="product-card-price">¥${product.price.toLocaleString()}</div>
                <div class="product-card-buttons">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); addToCartQuick(${product.id})">
                        カートに追加
                    </button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); showProductModal(${product.id})">
                        詳細
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function filterProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const category = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortFilter').value;
    
    let filtered = state.products.filter(product => {
        const matchesSearch = product.title.toLowerCase().includes(searchTerm) ||
                            product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || product.category === category;
        return matchesSearch && matchesCategory;
    });
    
    // ソート処理
    if (sortBy === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'popular') {
        filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'newest') {
        filtered.sort((a, b) => b.id - a.id);
    }
    
    displayProducts(filtered);
}

function getCategoryLabel(category) {
    const labels = {
        'model': '3Dモデル',
        'texture': 'テクスチャ',
        'material': 'マテリアル',
        'animation': 'アニメーション',
        'other': 'その他'
    };
    return labels[category] || category;
}

function showProductModal(productId) {
    state.currentProduct = state.products.find(p => p.id === productId);
    
    if (!state.currentProduct) return;
    
    document.getElementById('productTitle').textContent = state.currentProduct.title;
    document.getElementById('productImage').src = state.currentProduct.image;
    document.getElementById('productPrice').textContent = state.currentProduct.price.toLocaleString();
    document.getElementById('productCategory').textContent = getCategoryLabel(state.currentProduct.category);
    document.getElementById('productDescription').textContent = state.currentProduct.description;
    document.getElementById('productRating').textContent = state.currentProduct.rating;
    
    // レビューを表示
    displayReviews(state.currentProduct.reviews || []);
    
    // ユーザーがログインしている場合はレビューフォームを表示
    const reviewForm = document.getElementById('reviewForm');
    if (state.currentUser) {
        reviewForm.style.display = 'block';
    } else {
        reviewForm.style.display = 'none';
    }
    
    document.getElementById('productModal').classList.add('active');
}

function closeProductModal() {
    document.getElementById('productModal').classList.remove('active');
    state.currentProduct = null;
}

// ========== カート管理 ==========
function addToCartQuick(productId) {
    addProductToCart(productId);
    updateCartUI();
    
    // 簡単な通知
    const btn = event.target;
    const originalText = btn.textContent;
    btn.textContent = 'カートに追加しました！';
    btn.disabled = true;
    setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
    }, 2000);
}

function addToCart() {
    if (state.currentProduct) {
        addProductToCart(state.currentProduct.id);
        updateCartUI();
        closeProductModal();
        
        // 成功メッセージ
        showNotification('商品をカートに追加しました', 'success');
    }
}

function addProductToCart(productId) {
    const product = state.products.find(p => p.id === productId);
    
    if (!product) return;
    
    const existingItem = state.cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart.push({
            ...product,
            quantity: 1
        });
    }
    
    saveCartToStorage();
}

function removeFromCart(productId) {
    state.cart = state.cart.filter(item => item.id !== productId);
    saveCartToStorage();
    updateCartUI();
    displayCartItems();
}

function updateQuantity(productId, newQuantity) {
    const item = state.cart.find(item => item.id === productId);
    
    if (item) {
        if (newQuantity <= 0) {
            removeFromCart(productId);
        } else {
            item.quantity = newQuantity;
            saveCartToStorage();
            updateCartUI();
            displayCartItems();
        }
    }
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const total = calculateCartTotal();
    
    cartCount.textContent = state.cart.length;
    cartTotal.textContent = total.toLocaleString();
    
    // チェックアウトボタンの有効化
    const checkoutBtn = document.getElementById('checkoutBtn');
    checkoutBtn.disabled = state.cart.length === 0;
    
    // ユーザーがログインしていない場合はチェックアウトボタンを無効化
    if (!state.currentUser) {
        checkoutBtn.disabled = true;
    }
}

function calculateCartTotal() {
    return state.cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

function saveCartToStorage() {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(state.cart));
}

function loadCartFromStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEYS.CART);
        if (saved) {
            state.cart = JSON.parse(saved);
        }
    } catch (error) {
        console.error('カート復元エラー:', error);
    }
}

function showCartModal() {
    displayCartItems();
    document.getElementById('cartModal').classList.add('active');
    updateCartUI();
}

function closeCartModal() {
    document.getElementById('cartModal').classList.remove('active');
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cartItems');
    const total = calculateCartTotal();
    document.getElementById('modalCartTotal').textContent = total.toLocaleString();
    
    if (state.cart.length === 0) {
        cartItemsContainer.innerHTML = '<p>カートは空です</p>';
        return;
    }
    
    cartItemsContainer.innerHTML = state.cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-title">${item.title}</div>
                <div class="cart-item-price">¥${item.price.toLocaleString()}</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity - 1})">-</button>
                <span>${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity(${item.id}, ${item.quantity + 1})">+</button>
            </div>
            <button class="remove-btn" onclick="removeFromCart(${item.id})">削除</button>
        </div>
    `).join('');
}

async function handleCheckout() {
    if (!state.currentUser) {
        showNotification('チェックアウトするにはログインしてください', 'error');
        showAuthModal();
        return;
    }
    
    if (state.cart.length === 0) {
        showNotification('カートが空です', 'error');
        return;
    }
    
    try {
        // Stripe統合後ここで実装
        // const total = calculateCartTotal();
        // const response = await fetch('/api/checkout', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${localStorage.getItem(STORAGE_KEYS.USER_TOKEN)}`
        //     },
        //     body: JSON.stringify({
        //         items: state.cart,
        //         total: total
        //     })
        // });
        
        showNotification('チェックアウト機能は準備中です', 'info');
        
    } catch (error) {
        showNotification('チェックアウト処理エラー: ' + error.message, 'error');
    }
}

// ========== 購入履歴管理 ==========
function showPurchases() {
    const purchasesSection = document.getElementById('purchasesSection');
    if (state.currentUser) {
        purchasesSection.style.display = 'block';
        // 実装後はAPIから購入履歴を取得
        displayPurchases([]);
    }
}

function closePurchases() {
    document.getElementById('purchasesSection').style.display = 'none';
}

function displayPurchases(purchases) {
    const grid = document.getElementById('purchasesGrid');
    
    if (purchases.length === 0) {
        grid.innerHTML = '<p>購入済みのデータはありません</p>';
        return;
    }
    
    grid.innerHTML = purchases.map(purchase => `
        <div class="purchase-item">
            <div class="purchase-title">${purchase.title}</div>
            <div class="purchase-meta">
                購入日：${new Date(purchase.purchaseDate).toLocaleDateString('ja-JP')}
            </div>
            <a href="${purchase.downloadUrl}" class="download-btn">ダウンロード</a>
        </div>
    `).join('');
}

// ========== レビュー管理 ==========
function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviewsList');
    
    if (reviews.length === 0) {
        reviewsList.innerHTML = '<p>まだレビューはありません</p>';
        return;
    }
    
    reviewsList.innerHTML = reviews.map(review => `
        <div class="review-item">
            <div class="review-header">
                <div>
                    <div class="review-author">${review.author}</div>
                    <div class="review-date">${new Date(review.date).toLocaleDateString('ja-JP')}</div>
                </div>
            </div>
            <div class="review-rating">${'⭐'.repeat(review.rating)}</div>
            <div class="review-comment">${review.comment}</div>
        </div>
    `).join('');
}

async function submitReview() {
    if (!state.currentProduct) return;
    
    const rating = document.getElementById('reviewRating').value;
    const comment = document.getElementById('reviewComment').value;
    
    if (!rating || !comment) {
        showNotification('評価とコメントを入力してください', 'error');
        return;
    }
    
    try {
        // 実装後はAPIに送信
        const newReview = {
            author: state.currentUser.name || state.currentUser.email,
            rating: parseInt(rating),
            comment: comment,
            date: new Date().toISOString(),
            productId: state.currentProduct.id
        };
        
        // ローカルに追加（実装後はサーバーで保存）
        if (!state.currentProduct.reviews) {
            state.currentProduct.reviews = [];
        }
        state.currentProduct.reviews.push(newReview);
        
        // UIを更新
        displayReviews(state.currentProduct.reviews);
        document.getElementById('reviewRating').value = '';
        document.getElementById('reviewComment').value = '';
        
        showNotification('レビューを投稿しました', 'success');
        
    } catch (error) {
        showNotification('レビュー投稿エラー: ' + error.message, 'error');
    }
}

// ========== ユーティリティ ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `${type}-message show`;
    notification.textContent = message;
    
    document.querySelector('#market-main').insertBefore(
        notification,
        document.querySelector('#market-main').firstChild
    );
    
    setTimeout(() => notification.remove(), 4000);
}
