  
        // Pizza data
        const pizzas = [
            { id: 1, name: "Margherita", description: "Paradicsomszósz, mozzarella, bazsalikom", price: 1200, icon: "🧀" },
            { id: 2, name: "Quattro Formaggi", description: "Négy fajta sajt: mozzarella, gorgonzola, parmezan, ricotta", price: 1500, icon: "🧀" },
            { id: 3, name: "Pepperoni", description: "Paradicsomszósz, mozzarella, pepperoni", price: 1300, icon: "🌶️" },
            { id: 4, name: "Carnivore", description: "Szalonna, sonka, kolbász, hagyma", price: 1600, icon: "🥓" },
            { id: 5, name: "Vegetariana", description: "Paradicsom, paprika, gomba, zöldségek", price: 1250, icon: "🥒" },
            { id: 6, name: "Prosciutto e Rucola", description: "Prosciutto, rukkola, parmezan", price: 1450, icon: "🌿" },
            { id: 7, name: "BBQ Chicken", description: "BBQ szósz, csirke, lilahagyma, bacon", price: 1400, icon: "🍗" },
            { id: 8, name: "Quattro Stagioni", description: "Négy évszak: szalonna, gomba, tojás, olajbogyó", price: 1550, icon: "❄️" },
            { id: 9, name: "Calzone", description: "Zárható: ricotta, sonka, mozzarella", price: 1350, icon: "🥟" },
            { id: 10, name: "Spicy Diavola", description: "Csípős: pepperoni, chilipaprika, garlic", price: 1300, icon: "🌶️" },
            { id: 11, name: "Seafood Deluxe", description: "Garnéla, kagyló, tintahal, olívaolaj", price: 1800, icon: "🦐" },
            { id: 12, name: "Mushroom Paradise", description: "Kiváló gombák: csiperke, shiitake, portobello", price: 1280, icon: "🍄" },
            { id: 13, name: "Hawaiian Surprise", description: "Sonka, ananász, szalonna", price: 1400, icon: "🍍" },
            { id: 14, name: "Truffle Deluxe", description: "Fehér szarvasgomba, prosciutto, parmezan", price: 2000, icon: "💎" },
            { id: 15, name: "Bianca", description: "Fehér szósz, mozzarella, ricotta, spinát", price: 1150, icon: "⚪" }
        ];

        // Cart state (in-memory)
        let cart = {};

        // DOM Elements
        const pizzaGrid = document.getElementById('pizzaGrid');
        const cartButton = document.getElementById('cartButton');
        const cartBadge = document.getElementById('cartBadge');
        const cartModal = document.getElementById('cartModal');
        const closeModal = document.getElementById('closeModal');
        const cartItems = document.getElementById('cartItems');
        const cartTotal = document.getElementById('cartTotal');
        const orderForm = document.getElementById('orderForm');
        const submitOrder = document.getElementById('submitOrder');
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');
        const closeSuccess = document.getElementById('closeSuccess');
        const cartContent = document.getElementById('cartContent');

        // Render pizzas
        function renderPizzas() {
            pizzaGrid.innerHTML = pizzas.map(pizza => `
                <div class="pizza-card">
                    <div class="pizza-icon">${pizza.icon}</div>
                    <h3 class="pizza-name">${pizza.name}</h3>
                    <p class="pizza-description">${pizza.description}</p>
                    <div class="pizza-footer">
                        <span class="pizza-price">${pizza.price} Ft</span>
                        <button class="add-to-cart" onclick="addToCart(${pizza.id})">Kosárba</button>
                    </div>
                </div>
            `).join('');
        }

        // Add to cart
        function addToCart(pizzaId) {
            if (cart[pizzaId]) {
                cart[pizzaId].quantity++;
            } else {
                const pizza = pizzas.find(p => p.id === pizzaId);
                cart[pizzaId] = {
                    ...pizza,
                    quantity: 1
                };
            }
            updateCartBadge();
        }

        // Update cart badge
        function updateCartBadge() {
            const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
            cartBadge.textContent = totalItems;
        }

        // Render cart
        function renderCart() {
            const cartItemsArray = Object.values(cart);
            
            if (cartItemsArray.length === 0) {
                cartItems.innerHTML = '<div class="empty-cart">A kosár üres. Válasszon pizzát az étlapról!</div>';
                cartTotal.textContent = 'Összesen: 0 Ft';
                return;
            }

            cartItems.innerHTML = cartItemsArray.map(item => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.icon} ${item.name}</div>
                        <div class="cart-item-price">${item.price} Ft / db</div>
                    </div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="decreaseQuantity(${item.id})">−</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="increaseQuantity(${item.id})">+</button>
                    </div>
                </div>
            `).join('');

            const total = cartItemsArray.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            cartTotal.textContent = `Összesen: ${total.toLocaleString('hu-HU')} Ft`;
        }

        // Increase quantity
        function increaseQuantity(pizzaId) {
            if (cart[pizzaId]) {
                cart[pizzaId].quantity++;
                updateCartBadge();
                renderCart();
            }
        }

        // Decrease quantity
        function decreaseQuantity(pizzaId) {
            if (cart[pizzaId]) {
                cart[pizzaId].quantity--;
                if (cart[pizzaId].quantity === 0) {
                    delete cart[pizzaId];
                }
                updateCartBadge();
                renderCart();
            }
        }

        // Open cart modal
        cartButton.addEventListener('click', () => {
            renderCart();
            cartModal.classList.add('active');
        });

        // Close modal
        closeModal.addEventListener('click', () => {
            cartModal.classList.remove('active');
        });

        // Close modal on background click
        cartModal.addEventListener('click', (e) => {
            if (e.target === cartModal) {
                cartModal.classList.remove('active');
            }
        });

        // Submit order
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Validate cart
            if (Object.keys(cart).length === 0) {
                errorMessage.textContent = 'A kosár üres! Kérjük, válasszon legalább egy pizzát.';
                errorMessage.classList.add('active');
                return;
            }

            // Get form data
            const customerName = document.getElementById('customerName').value.trim();
            const customerEmail = document.getElementById('customerEmail').value.trim();
            const customerPhone = document.getElementById('customerPhone').value.trim();
            const customerAddress = document.getElementById('customerAddress').value.trim();
            const customerNotes = document.getElementById('customerNotes').value.trim();

            // Validate required fields
            if (!customerName || !customerEmail || !customerPhone || !customerAddress) {
                errorMessage.textContent = 'Kérjük, töltse ki az összes kötelező mezőt!';
                errorMessage.classList.add('active');
                return;
            }

            // Prepare order data
            const items = Object.values(cart).map(item => ({
                pizza_id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price
            }));

            const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

            const orderData = {
                customer_name: customerName,
                email: customerEmail,
                phone: customerPhone,
                address: customerAddress,
                notes: customerNotes,
                payment_method: 'utanvet',
                items: items,
                total: total
            };

            // Show loading state
            submitOrder.disabled = true;
            submitOrder.innerHTML = '<span class="loading"></span> Küldés...';
            errorMessage.classList.remove('active');

            try {
                // Send order to backend
                const response = await fetch('https://beadapi.ptzal.hu/api/orders', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(orderData)
                });

                if (!response.ok) {
                    throw new Error('A rendelés küldése sikertelen. Kérjük, próbálja újra később.');
                }

                const result = await response.json();
                
                // Show success message
                cartContent.style.display = 'none';
                orderForm.style.display = 'none';
                successMessage.style.display = 'block';
                
                const orderNumber = result.order_id || Math.random().toString(36).substr(2, 9).toUpperCase();
                document.getElementById('orderNumber').textContent = `Rendelési szám: #${orderNumber}`;
                
                // Reset cart
                cart = {};
                updateCartBadge();
                
            } catch (error) {
                errorMessage.textContent = error.message;
                errorMessage.classList.add('active');
            } finally {
                submitOrder.disabled = false;
                submitOrder.textContent = 'Rendelés küldése';
            }
        });

        // Close success and reset modal
        closeSuccess.addEventListener('click', () => {
            cartModal.classList.remove('active');
            cartContent.style.display = 'block';
            orderForm.style.display = 'block';
            successMessage.style.display = 'none';
            orderForm.reset();
        });

        // Initialize
        renderPizzas();