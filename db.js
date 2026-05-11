const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'store.db');

let db;

function initDB() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(DB_PATH, (err) => {
            if (err) return reject(err);
            console.log('📦 База данных подключена');

            db.serialize(() => {
                // Таблица товаров
                db.run(`CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    description TEXT,
                    price REAL NOT NULL,
                    category TEXT NOT NULL,
                    image TEXT DEFAULT '/images/no-photo.png',
                    stock INTEGER DEFAULT 999,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Таблица заказов
                db.run(`CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_number TEXT UNIQUE NOT NULL,
                    customer_name TEXT NOT NULL,
                    customer_email TEXT NOT NULL,
                    customer_phone TEXT,
                    customer_address TEXT,
                    total REAL NOT NULL,
                    status TEXT DEFAULT 'pending',
                    payment_id TEXT,
                    payment_status TEXT DEFAULT 'pending',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`);

                // Таблица позиций заказа
                db.run(`CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    product_name TEXT NOT NULL,
                    price REAL NOT NULL,
                    quantity INTEGER NOT NULL,
                    FOREIGN KEY (order_id) REFERENCES orders(id)
                )`);

                // Начальные товары (если таблица пуста)
                db.get('SELECT COUNT(*) as count FROM products', (err, row) => {
                    if (err) return reject(err);
                    if (row.count === 0) {
                        seedProducts();
                    }
                    resolve();
                });
            });
        });
    });
}

function seedProducts() {
    const products = [
        ['Футболка «Дима Сторыч»', 'Классная футболка с логотипом Димы Сторыча. 100% хлопок.', 1499, 'Одежда', '/images/tshirt.png'],
        ['Кружка «Сторыч»', 'Керамическая кружка 350 мл. Сторыч согреет!', 699, 'Посуда', '/images/mug.png'],
        ['Стикерпак «Дима»', 'Набор из 10 виниловых стикеров с Димой.', 399, 'Стикеры', '/images/stickers.png'],
        ['Худи «Сторыч»', 'Тёплое худи с капюшоном. Размеры S-XXL.', 3499, 'Одежда', '/images/hoodie.png'],
        ['Блокнот «Заметки Сторыча»', 'Блокнот А5, 80 листов. Записывай свои мысли!', 249, 'Канцелярия', '/images/notebook.png'],
        ['Чехол для телефона', 'Силиконовый чехол с принтом. Для iPhone и Samsung.', 899, 'Аксессуары', '/images/case.png'],
        ['Коврик для мыши', 'Игровой коврик 90×40 см с Димой Сторычем.', 1299, 'Аксессуары', '/images/mousepad.png'],
        ['Шоппер «Сторыч»', 'Эко-сумка из плотной ткани. Вместительная!', 799, 'Сумки', '/images/totebag.png'],
    ];

    const stmt = db.prepare('INSERT INTO products (name, description, price, category, image) VALUES (?, ?, ?, ?, ?)');
    products.forEach(p => stmt.run(p));
    stmt.finalize();
    console.log('🌱 Добавлены начальные товары');
}

function getDB() {
    return db;
}

module.exports = { initDB, getDB };
