const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

// Страница выбора способа оплаты
router.get('/select', (req, res) => {
    const order = req.session.lastOrder;
    if (!order) return res.redirect('/cart');
    res.render('payment-select', { title: 'Выбор оплаты', order });
});

// Создание платежа через ЮKassa
router.post('/create', async (req, res) => {
    const order = req.session.lastOrder;
    if (!order) return res.redirect('/cart');

    const { payment_method } = req.body; // bank_card, sbp, yoo_money

    const shopId = process.env.SHOP_ID;
    const secretKey = process.env.SECRET_KEY;

    if (!shopId || !secretKey || shopId === 'your_shop_id_here') {
        // Тестовый режим — имитация оплаты
        const db = getDB();
        const fakePaymentId = 'test_' + uuidv4();
        db.run(
            'UPDATE orders SET payment_id = ?, payment_status = ? WHERE id = ?',
            [fakePaymentId, 'succeeded', order.id],
            err => {
                if (err) console.error(err);
                req.session.lastOrder.paymentId = fakePaymentId;
                res.redirect('/order/success');
            }
        );
        return;
    }

    try {
        // Реальная ЮKassa
        const auth = Buffer.from(`${shopId}:${secretKey}`).toString('base64');

        const paymentData = {
            amount: {
                value: order.total.toFixed(2),
                currency: 'RUB'
            },
            capture: true,
            confirmation: {
                type: 'redirect',
                return_url: `http://localhost:${process.env.PORT || 3000}/order/success`
            },
            description: `Заказ №${order.number} в Дима Сторыч`,
            metadata: {
                order_id: String(order.id),
                order_number: order.number
            }
        };

        // Если выбран конкретный метод
        if (payment_method && payment_method !== 'any') {
            paymentData.payment_method_data = { type: payment_method };
        }

        const response = await fetch('https://api.yookassa.ru/v3/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`,
                'Idempotence-Key': uuidv4()
            },
            body: JSON.stringify(paymentData)
        });

        const payment = await response.json();

        if (payment.id) {
            const db = getDB();
            db.run(
                'UPDATE orders SET payment_id = ? WHERE id = ?',
                [payment.id, order.id],
                err => {
                    if (err) console.error(err);
                }
            );

            // Редирект на страницу оплаты ЮKassa
            res.redirect(payment.confirmation.confirmation_url);
        } else {
            console.error('Ошибка ЮKassa:', payment);
            res.status(500).send('Ошибка создания платежа: ' + (payment.description || 'Неизвестная ошибка'));
        }
    } catch (err) {
        console.error('Ошибка при создании платежа:', err);
        res.status(500).send('Ошибка сервера при создании платежа');
    }
});

// Webhook для уведомлений от ЮKassa
router.post('/webhook', (req, res) => {
    const event = req.body;

    console.log('Webhook от ЮKassa:', JSON.stringify(event, null, 2));

    if (event.event === 'payment.succeeded') {
        const payment = event.object;
        const orderId = payment.metadata?.order_id;

        if (orderId) {
            const db = getDB();
            db.run(
                'UPDATE orders SET payment_status = ? WHERE id = ?',
                ['succeeded', orderId],
                err => {
                    if (err) console.error(err);
                    else console.log(`✅ Заказ #${orderId} оплачен!`);
                }
            );
        }
    }

    res.status(200).send('OK');
});

module.exports = router;
