(function() {
    'use strict';

    function sanitizeQuantity(value) {
        const parsed = parseInt(value, 10);
        if (!Number.isFinite(parsed) || isNaN(parsed)) return 1;
        return Math.max(1, parsed);
    }

    function updateCartCount() {
        fetch('/api/cart/count')
            .then(response => response.json())
            .then(data => {
                const countElement = document.querySelector('.js-cart-count');
                if (countElement) {
                    const count = data.count || 0;
                    countElement.textContent = count;
                    if (count > 0) {
                        countElement.style.display = 'inline-block';
                    } else {
                        countElement.style.display = 'none';
                    }
                }
            })
            .catch(error => console.error('Error updating cart count:', error));
    }

    function collectSelectedAttributeValueIds(container) {
        const root = container || document;
        const checked = Array.from(root.querySelectorAll('input[type="radio"][name^="attr-"]:checked'));
        return checked
            .map((el) => parseInt(el.value, 10))
            .filter((v) => Number.isFinite(v) && !isNaN(v) && v > 0);
    }

    function addToCart(slug, quantity = 1) {
        const container = document.querySelector('.site-section') || document;
        const selectedAttributeValueIds = collectSelectedAttributeValueIds(container);

        fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ slug, quantity: sanitizeQuantity(quantity), selectedAttributeValueIds })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                updateCartCount();
                // alert('Produkt dodany do koszyka!');
            }
        })
        .catch(error => {
            console.error('Error adding to cart:', error);
            // alert('Błąd podczas dodawania produktu do koszyka.');
        });
    }

    function updateCartItem(key, quantity) {
        fetch(`/api/cart/update/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity: sanitizeQuantity(quantity) })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                updateCartCount();
                window.location.reload();
            }
        })
        .catch(error => {
            console.error('Error updating cart:', error);
            // alert('Błąd podczas aktualizacji koszyka.');
        });
    }

    function updateCartItemMeta(key, payload) {
        fetch(`/api/cart/update/${encodeURIComponent(key)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(() => {
            // No reload needed.
        })
        .catch(error => {
            console.error('Error updating cart item meta:', error);
        });
    }

    function getDedicationContainer(key) {
        return document.querySelector(`.js-dedications[data-key="${CSS.escape(key)}"]`);
    }

    function updateRecipientEntryFromElement(el) {
        const key = el.getAttribute('data-key');
        const indexRaw = el.getAttribute('data-index');
        const idx = parseInt(indexRaw, 10);
        if (!key) return;
        if (!Number.isFinite(idx) || isNaN(idx) || idx < 0) return;

        const container = getDedicationContainer(key);
        if (!container) return;

        const recipientInput = container.querySelector(`.js-recipient-name[data-key="${CSS.escape(key)}"][data-index="${idx}"]`);
        const dedicationTextarea = container.querySelector(`.js-dedication[data-key="${CSS.escape(key)}"][data-index="${idx}"]`);

        updateCartItemMeta(key, {
            recipientIndex: idx,
            recipientName: recipientInput ? recipientInput.value : '',
            dedication: dedicationTextarea ? dedicationTextarea.value : '',
        });
    }

    function removeFromCart(key) {
        // if (!confirm('Czy na pewno chcesz usunąć ten produkt z koszyka?')) {
        //     return;
        // }

        fetch(`/api/cart/remove/${encodeURIComponent(key)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                updateCartCount();
                const row = document.querySelector(`tr[data-key="${CSS.escape(key)}"]`);
                if (row) {
                    row.remove();
                }
                window.location.reload();
            }
        })
        .catch(error => {
            console.error('Error removing from cart:', error);
            // alert('Błąd podczas usuwania produktu z koszyka.');
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        updateCartCount();

        document.querySelectorAll('.js-add-to-cart').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const slug = this.getAttribute('data-slug');
                const container = this.closest('.col-md-6, .block-4-text, .site-section');
                const quantityInput = container ? container.querySelector('.form-control.text-center') : document.querySelector('.form-control.text-center');
                const quantity = sanitizeQuantity(quantityInput ? quantityInput.value : 1);
                addToCart(slug, quantity);
            });
        });

        document.querySelectorAll('.js-cart-plus').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.getAttribute('data-key') || this.getAttribute('data-slug');
                const input = document.querySelector(`.js-cart-quantity[data-key="${CSS.escape(key)}"]`);
                if (input) {
                    const newQuantity = sanitizeQuantity(input.value) + 1;
                    updateCartItem(key, newQuantity);
                }
            });
        });

        document.querySelectorAll('.js-cart-minus').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.getAttribute('data-key') || this.getAttribute('data-slug');
                const input = document.querySelector(`.js-cart-quantity[data-key="${CSS.escape(key)}"]`);
                if (input) {
                    const currentQuantity = sanitizeQuantity(input.value);
                    if (currentQuantity > 1) {
                        const newQuantity = currentQuantity - 1;
                        updateCartItem(key, newQuantity);
                    } else {
                        removeFromCart(key);
                    }
                }
            });
        });

        document.querySelectorAll('.js-cart-remove').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.getAttribute('data-key') || this.getAttribute('data-slug');
                removeFromCart(key);
            });
        });

        document.querySelectorAll('.js-toggle-dedications').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const key = this.getAttribute('data-key');
                if (!key) return;
                const container = getDedicationContainer(key);
                if (!container) return;
                container.style.display = container.style.display === 'none' ? 'block' : 'none';
            });
        });

        document.querySelectorAll('.js-recipient-name').forEach(input => {
            input.addEventListener('blur', function() {
                updateRecipientEntryFromElement(this);
            });
        });

        document.querySelectorAll('.js-dedication').forEach(textarea => {
            textarea.addEventListener('blur', function() {
                updateRecipientEntryFromElement(this);
            });
        });
    });

})();

