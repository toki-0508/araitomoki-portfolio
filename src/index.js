// Modal functionality
document.addEventListener('DOMContentLoaded', function() {
    // Get all modal triggers
    const modalTriggers = document.querySelectorAll('[data-target]');
    const modals = document.querySelectorAll('.modal');
    const closeButtons = document.querySelectorAll('.close');

    // Open modal
    modalTriggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            const modal = document.getElementById(targetId);
            if (modal) {
                modal.style.display = 'block';
                document.body.style.overflow = 'hidden'; // Prevent scrolling
            }
        });
    });

    // Close modal when clicking close button
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    });

    // Close modal when clicking outside
    modals.forEach(modal => {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                this.style.display = 'none';
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Close modal on ESC key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                modal.style.display = 'none';
                document.body.style.overflow = 'auto';
            });
        }
    });

    // Contact form handling
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const resultDiv = document.getElementById('result');
            const formData = new FormData(this);
            
            // Show loading state
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = '送信中...';
            submitBtn.disabled = true;
            
            fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    resultDiv.style.display = 'block';
                    resultDiv.style.background = 'rgba(76, 175, 80, 0.2)';
                    resultDiv.style.color = '#4CAF50';
                    resultDiv.style.border = '2px solid #4CAF50';
                    resultDiv.textContent = 'メッセージが正常に送信されました!';
                    contactForm.reset();
                    
                    // Hide result after 5 seconds
                    setTimeout(() => {
                        resultDiv.style.display = 'none';
                    }, 5000);
                } else {
                    resultDiv.style.display = 'block';
                    resultDiv.style.background = 'rgba(244, 67, 54, 0.2)';
                    resultDiv.style.color = '#f44336';
                    resultDiv.style.border = '2px solid #f44336';
                    resultDiv.textContent = 'エラーが発生しました。もう一度お試しください。';
                }
            })
            .catch(error => {
                console.error('Error:', error);
                resultDiv.style.display = 'block';
                resultDiv.style.background = 'rgba(244, 67, 54, 0.2)';
                resultDiv.style.color = '#f44336';
                resultDiv.style.border = '2px solid #f44336';
                resultDiv.textContent = 'ネットワークエラーが発生しました。';
            })
            .finally(() => {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
        });
    }
    
    // Show success message if redirected from Web3Forms
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
        const resultDiv = document.getElementById('result');
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.style.background = 'rgba(76, 175, 80, 0.2)';
            resultDiv.style.color = '#4CAF50';
            resultDiv.style.border = '2px solid #4CAF50';
            resultDiv.textContent = 'メッセージが正常に送信されました!';
            
            setTimeout(() => {
                resultDiv.style.display = 'none';
                window.history.replaceState(null, '', 'contact.html');
            }, 5000);
        }
    }
});