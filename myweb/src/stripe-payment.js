// Stripe 支払い処理
// https://stripe.com/docs/js

let stripe;
let elements;
let cardElement;

// 現在のAPI_BASE_URLを共有
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51234567890'; // .envから取得するか、HTMLバッグから設定

document.addEventListener('DOMContentLoaded', () => {
    initializeStripe();
    setupPaymentEventListeners();
});

function initializeStripe() {
    // 実装時：Stripe.jsライブラリが読み込まれたら実行
    if (typeof Stripe !== 'undefined') {
        stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
        elements = stripe.elements();
        cardElement = elements.create('card');
        cardElement.mount('#card-element');
        
        // エラーハンドリング
        cardElement.on('change', function(event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
                displayError.textContent = event.error.message;
            } else {
                displayError.textContent = '';
            }
        });
    }
}

function setupPaymentEventListeners() {
    const paymentForm = document.getElementById('paymentForm');
    const closePaymentBtn = document.getElementById('closePaymentBtn');
    const paymentModal = document.getElementById('paymentModal');
    
    if (paymentForm) {
        paymentForm.addEventListener('submit', handlePaymentSubmit);
    }
    
    if (closePaymentBtn) {
        closePaymentBtn.addEventListener('click', closePaymentModal);
    }
    
    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                closePaymentModal();
            }
        });
    }
}

function openPaymentModal() {
    const paymentModal = document.getElementById('paymentModal');
    const paymentItems = document.getElementById('paymentItems');
    const paymentTotal = document.getElementById('paymentTotal');
    const paymentButtonAmount = document.getElementById('paymentButtonAmount');
    
    // カート内容を表示
    const total = calculateCartTotal();
    let itemsHTML = '';
    
    if (state.cart && state.cart.length > 0) {
        itemsHTML = state.cart.map(item => `
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e0e7ff;">
                <div>
                    <span>${item.title}</span><br/>
                    <small>×${item.quantity}</small>
                </div>
                <div>¥${(item.price * item.quantity).toLocaleString()}</div>
            </div>
        `).join('');
    }
    
    paymentItems.innerHTML = itemsHTML;
    paymentTotal.textContent = total.toLocaleString();
    paymentButtonAmount.textContent = total.toLocaleString();
    
    // ユーザー情報を入力
    if (state.currentUser) {
        document.getElementById('paymentEmail').value = state.currentUser.email;
        document.getElementById('paymentName').value = state.currentUser.name || '';
    }
    
    paymentModal.classList.add('active');
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.remove('active');
}

async function handlePaymentSubmit(e) {
    e.preventDefault();
    
    if (!state.currentUser) {
        showNotification('ログインしてください', 'error');
        return;
    }
    
    const paymentSubmitBtn = document.getElementById('paymentSubmitBtn');
    const paymentEmail = document.getElementById('paymentEmail').value;
    const paymentName = document.getElementById('paymentName').value;
    
    try {
        paymentSubmitBtn.disabled = true;
        paymentSubmitBtn.textContent = '処理中...';
        
        // 1. Client Secret を取得
        const token = localStorage.getItem(STORAGE_KEYS.USER_TOKEN);
        const secretResponse = await fetch(`${API_BASE_URL}/create-payment-intent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: state.cart
            })
        });
        
        if (!secretResponse.ok) {
            const error = await secretResponse.json();
            throw new Error(error.message || 'PaymentIntent作成エラー');
        }
        
        const { clientSecret } = await secretResponse.json();
        
        // 2. 支払いを確認
        const { paymentIntent, error } = await stripe.confirmCardPayment(clientSecret, {
            payment_method: {
                card: cardElement,
                billing_details: {
                    name: paymentName,
                    email: paymentEmail
                }
            }
        });
        
        if (error) {
            throw new Error(error.message);
        }
        
        if (paymentIntent.status === 'succeeded') {
            // 3. サーバーに購入記録を保存
            const checkoutResponse = await fetch(`${API_BASE_URL}/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    items: state.cart,
                    stripePaymentIntentId: paymentIntent.id
                })
            });
            
            if (!checkoutResponse.ok) {
                const error = await checkoutResponse.json();
                throw new Error(error.message || 'チェックアウトエラー');
            }
            
            // 成功
            showNotification('支払い完了！購入ありがとうございます', 'success');
            closePaymentModal();
            clearCart();
            loadPurchases(); // 購入履歴を更新
            
        } else {
            throw new Error('支払いが完了していません');
        }
        
    } catch (error) {
        console.error('支払い処理エラー:', error);
        showNotification('支払い処理エラー: ' + error.message, 'error');
        
    } finally {
        paymentSubmitBtn.disabled = false;
        paymentSubmitBtn.textContent = 'クレジットカードで支払う';
    }
}

function clearCart() {
    state.cart = [];
    localStorage.removeItem(STORAGE_KEYS.CART);
    updateCartUI();
}
