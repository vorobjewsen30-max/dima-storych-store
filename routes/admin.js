const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// Middleware проверки админа
function requireAdmin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect('/admin/login');
}

// Страница логина
router.get('/login', (req, res) => {
    res.render('admin-login', { title: 'Админка — Вход', error: null });
});

router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD || password === 'admin123') {
        req.session.isAdmin = true;
        return res.redirect('/admin');
    }
    res.render('admin-login', { title: 'Админка — Вход', error: 'Неверный пароль' });
});

router.get('/logout', (req, res) => {
    req.session.isAdmin = false;
    res.redirect('/');
});

// Главная админки
router.get('/', requireAdmin, (req, res) => {
    const db = getDB();

    db.get('SELECT COUNT(*) as count FROM orders', (err, ordersRow) => {
        db.get('SELECT COUNT(*) as count FROM products', (err, productsRow) => {
            db.get('SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE payment_status = "succeeded"', (err, revenueRow) => {
                res.render('admin', {
                    title: 'Админ-панель',
                    ordersCount: ordersRow.count,
                    productsCount: productsRow.count,
                    revenue: revenueRow.total
                });
            });
        });
    });
});

// Список товаров
router.get('/products', requireAdmin, (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM products ORDER BY id DESC', (err, products) => {
        res.render('admin-products', { title: 'Управление товарами', products });
    });
});

// Добавить товар (форма)
router.get('/products/add', requireAdmin, (req, res) => {
    res.render('admin-product-form', { title: 'Добавить товар', product: null });
});

// Добавить товар (POST)
router.post('/products/add', requireAdmin, (req, res) => {
    const { name, description, price, category, image, stock } = req.body;
    const db = getDB();
    db.run(
        'INSERT INTO products (name, description, price, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description, parseFloat(price), category, image || '/images/no-photo.png', parseInt(stock) || 999],
        err => {
            if (err) console.error(err);
            res.redirect('/admin/products');
        }
    );
});

// Редактировать товар
router.get('/products/edit/:id', requireAdmin, (req, res) => {
    const db = getDB();
    db.get('SELECT * FROM products WHERE id = ?', [req.params.id], (err, product) => {
        if (err || !product) return res.redirect('/admin/products');
        res.render('admin-product-form', { title: 'Редактировать товар', product });
    });
});

router.post('/products/edit/:id', requireAdmin, (req, res) => {
    const { name, description, price, category, image, stock } = req.body;
    const db = getDB();
    db.run(
        'UPDATE products SET name=?, description=?, price=?, category=?, image=?, stock=? WHERE id=?',
        [name, description, parseFloat(price), category, image || '/images/no-photo.png', parseInt(stock) || 999, req.params.id],
        err => {
            if (err) console.error(err);
            res.redirect('/admin/products');
        }
    );
});

// Удалить товар
router.post('/products/delete/:id', requireAdmin, (req, res) => {
    const db = getDB();
    db.run('DELETE FROM products WHERE id = ?', [req.params.id], err => {
        if (err) console.error(err);
        res.redirect('/admin/products');
    });
});

// Список заказов
router.get('/orders', requireAdmin, (req, res) => {
    const db = getDB();
    db.all('SELECT * FROM orders ORDER BY created_at DESC', (err, orders) => {
        res.render('admin-orders', { title: 'Заказы', orders });
    });
});

// Детали заказа
router.get('/orders/:id', requireAdmin, (req, res) => {
    const db = getDB();
    db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
        if (err || !order) return res.redirect('/admin/orders');
        db.all('SELECT * FROM order_items WHERE order_id = ?', [order.id], (err, items) => {
            res.render('admin-order-detail', { title: 'Заказ #' + order.order_number, order, items });
        });
    });
});

// Обновить статус заказа
router.post('/orders/:id/status', requireAdmin, (req, res) => {
    const { status } = req.body;
    const db = getDB();
    db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], err => {
        if (err) console.error(err);
        res.redirect('/admin/orders/' + req.params.id);
    });
});

module.exports = router;
