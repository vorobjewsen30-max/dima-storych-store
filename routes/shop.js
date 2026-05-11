const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Главная страница — каталог
router.get('/', (req, res) => {
    const db = getDB();
    const category = req.query.category || '';

    let query = 'SELECT * FROM products';
    let params = [];

    if (category) {
        query += ' WHERE category = ?';
        params.push(category);
    }

    query += ' ORDER BY created_at DESC';

    db.all(query, params, (err, products) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка сервера');
        }

        // Получаем все категории для фильтра
        db.all('SELECT DISTINCT category FROM products ORDER BY category', (err, categories) => {
            res.render('index', {
                title: 'Дима Сторыч — Магазин',
                products,
                categories,
                currentCategory: category
            });
        });
    });
});

// Страница товара
router.get('/product/:id', (req, res) => {
    const db = getDB();
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, product) => {
        if (err || !product) {
            return res.status(404).render('404', { title: 'Товар не найден' });
        }
        res.render('product', { title: product.name, product });
    });
});

// Добавить в корзину
router.post('/cart/add', (req, res) => {
    const { product_id, quantity } = req.body;
    const db = getDB();

    db.get('SELECT * FROM products WHERE id = ?', [product_id], (err, product) => {
        if (err || !product) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        const cart = req.session.cart;
        const existing = cart.find(item => item.product_id == product_id);

        if (existing) {
            existing.quantity += parseInt(quantity) || 1;
        } else {
            cart.push({
                product_id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                quantity: parseInt(quantity) || 1
            });
        }

        req.session.cart = cart;
        res.json({ success: true, cartCount: cart.reduce((s, i) => s + i.quantity, 0) });
    });
});

// Удалить из корзины
router.post('/cart/remove', (req, res) => {
    const { product_id } = req.body;
    req.session.cart = req.session.cart.filter(item => item.product_id != product_id);
    res.redirect('/cart');
});

// Обновить количество
router.post('/cart/update', (req, res) => {
    const { product_id, quantity } = req.body;
    const cart = req.session.cart;
    const item = cart.find(i => i.product_id == product_id);
    if (item) {
        item.quantity = Math.max(1, parseInt(quantity) || 1);
    }
    req.session.cart = cart;
    res.redirect('/cart');
});

// Страница корзины
router.get('/cart', (req, res) => {
    res.render('cart', { title: 'Корзина' });
});

// Страница оформления заказа
router.get('/checkout', (req, res) => {
    if (req.session.cart.length === 0) {
        return res.redirect('/cart');
    }
    res.render('checkout', { title: 'Оформление заказа' });
});

// Создание заказа
router.post('/checkout', (req, res) => {
    const { name, email, phone, address } = req.body;
    const cart = req.session.cart;
    const db = getDB();

    if (cart.length === 0) {
        return res.redirect('/cart');
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const orderNumber = 'DST-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    db.run(
        'INSERT INTO orders (order_number, customer_name, customer_email, customer_phone, customer_address, total) VALUES (?, ?, ?, ?, ?, ?)',
        [orderNumber, name, email, phone, address, total],
        function (err) {
            if (err) {
                console.error(err);
                return res.status(500).send('Ошибка создания заказа');
            }

            const orderId = this.lastID;

            // Добавляем позиции заказа
            const stmt = db.prepare('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)');
            cart.forEach(item => {
                stmt.run([orderId, item.product_id, item.name, item.price, item.quantity]);
            });
            stmt.finalize();

            // Сохраняем заказ в сессии для оплаты
            req.session.lastOrder = { id: orderId, number: orderNumber, total };

            res.redirect('/payment/select');
        }
    );
});

// Страница успешного заказа
router.get('/order/success', (req, res) => {
    const order = req.session.lastOrder;
    if (!order) return res.redirect('/');
    req.session.cart = [];
    res.render('order-success', { title: 'Заказ оформлен!', order });
});

module.exports = router;
