require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { initDB } = require('./db');
const shopRoutes = require('./routes/shop');
const adminRoutes = require('./routes/admin');
const paymentRoutes = require('./routes/payment');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы
app.use(express.static(path.join(__dirname, 'public')));

// Сессии
app.use(session({
    secret: process.env.SESSION_SECRET || 'dima-storych-secret',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 часа
}));

// Body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Передаём корзину во все шаблоны
app.use((req, res, next) => {
    if (!req.session.cart) {
        req.session.cart = [];
    }
    res.locals.cart = req.session.cart;
    res.locals.cartCount = req.session.cart.reduce((sum, item) => sum + item.quantity, 0);
    res.locals.cartTotal = req.session.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    res.locals.isAdmin = req.session.isAdmin || false;
    next();
});

// Авто-обёртка в layout
app.use((req, res, next) => {
    const originalRender = res.render;
    res.render = function(view, options, callback) {
        const opts = options || {};
        originalRender.call(this, view, opts, (err, html) => {
            if (err) {
                if (callback) return callback(err);
                return next(err);
            }
            // Оборачиваем в layout, передавая html как body
            originalRender.call(this, 'layout', { ...opts, body: html }, callback);
        });
    };
    next();
});

// Маршруты
app.use('/', shopRoutes);
app.use('/admin', adminRoutes);
app.use('/payment', paymentRoutes);

// Инициализация БД и запуск
initDB().then(() => {
    app.listen(PORT, () => {
        console.log('🛒 Дима Сторыч запущен: http://localhost:' + PORT);
    });
}).catch(err => {
    console.error('Ошибка инициализации БД:', err);
});
