(function() {
    'use strict';

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

    function addToCart(slug, quantity = 1) {
        fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ slug, quantity })
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                updateCartCount();
                alert('Produkt dodany do koszyka!');
            }
        })
        .catch(error => {
            console.error('Error adding to cart:', error);
            alert('Błąd podczas dodawania produktu do koszyka.');
        });
    }

    function updateCartItem(slug, quantity) {
        fetch(`/api/cart/update/${slug}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity })
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
            alert('Błąd podczas aktualizacji koszyka.');
        });
    }

    function removeFromCart(slug) {
        if (!confirm('Czy na pewno chcesz usunąć ten produkt z koszyka?')) {
            return;
        }

        fetch(`/api/cart/remove/${slug}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                updateCartCount();
                const row = document.querySelector(`tr[data-slug="${slug}"]`);
                if (row) {
                    row.remove();
                }
                window.location.reload();
            }
        })
        .catch(error => {
            console.error('Error removing from cart:', error);
            alert('Błąd podczas usuwania produktu z koszyka.');
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
                const quantity = quantityInput ? parseInt(quantityInput.value) || 1 : 1;
                addToCart(slug, quantity);
            });
        });

        document.querySelectorAll('.js-cart-plus').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const slug = this.getAttribute('data-slug');
                const input = document.querySelector(`.js-cart-quantity[data-slug="${slug}"]`);
                if (input) {
                    const newQuantity = parseInt(input.value) + 1;
                    updateCartItem(slug, newQuantity);
                }
            });
        });

        document.querySelectorAll('.js-cart-minus').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const slug = this.getAttribute('data-slug');
                const input = document.querySelector(`.js-cart-quantity[data-slug="${slug}"]`);
                if (input) {
                    const currentQuantity = parseInt(input.value);
                    if (currentQuantity > 1) {
                        const newQuantity = currentQuantity - 1;
                        updateCartItem(slug, newQuantity);
                    } else {
                        removeFromCart(slug);
                    }
                }
            });
        });

        document.querySelectorAll('.js-cart-remove').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();
                const slug = this.getAttribute('data-slug');
                removeFromCart(slug);
            });
        });
    });

})();

