import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || true
}));

app.use(express.json());

let portfolio = {
  startingCash: 100000,
  cash: 100000,
  totalInvested: 0,
  positions: {},
  orders: []
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'TechStock API' });
});

app.get('/api/paper-trading/summary', (req, res) => {
  res.json({ portfolio });
});

app.post('/api/paper-trading/orders', (req, res) => {
  const { symbol, side, quantity, price } = req.body ?? {};

  const stock = String(symbol || '').trim().toUpperCase();
  const qty = Number(quantity);
  const executionPrice = Number(price);

  if (
    !/^[A-Z0-9.-]{1,20}$/.test(stock) ||
    !['buy', 'sell'].includes(side) ||
    !Number.isFinite(qty) ||
    !Number.isFinite(executionPrice) ||
    qty <= 0 ||
    executionPrice <= 0
  ) {
    return res.status(400).json({ error: 'Invalid order details.' });
  }

  const value = qty * executionPrice;

  if (!Number.isFinite(value)) {
    return res.status(400).json({ error: 'Invalid order value.' });
  }

  const existing = portfolio.positions[stock] || {
    symbol: stock,
    quantity: 0,
    averagePrice: 0,
    lastPrice: 0
  };

  if (side === 'buy') {
    if (value > portfolio.cash) {
      return res.status(400).json({ error: 'Insufficient available cash.' });
    }

    const newQuantity = existing.quantity + qty;

    existing.averagePrice =
      ((existing.quantity * existing.averagePrice) + value) /
      newQuantity;

    existing.quantity = newQuantity;
    existing.lastPrice = executionPrice;

    portfolio.cash -= value;
    portfolio.positions[stock] = existing;
  } else {
    if (qty > existing.quantity) {
      return res.status(400).json({ error: 'Insufficient shares to sell.' });
    }

    existing.quantity -= qty;
    existing.lastPrice = executionPrice;

    portfolio.cash += value;

    if (existing.quantity === 0) {
      delete portfolio.positions[stock];
    } else {
      portfolio.positions[stock] = existing;
    }
  }

  portfolio.totalInvested = Object.values(portfolio.positions)
    .reduce((total, position) =>
      total + position.quantity * position.averagePrice, 0
    );

  portfolio.orders.push({
    id: randomUUID(),
    symbol: stock,
    side,
    quantity: qty,
    price: executionPrice,
    value,
    executedAt: new Date().toISOString()
  });

  res.json({ portfolio });
});

app.put('/api/paper-trading/reset', (req, res) => {
  const startingCash = Number(req.body?.startingCash);

  if (!Number.isFinite(startingCash) || startingCash <= 0) {
    return res.status(400).json({ error: 'Invalid starting cash.' });
  }

  portfolio = {
    startingCash,
    cash: startingCash,
    totalInvested: 0,
    positions: {},
    orders: []
  };

  res.json({ portfolio });
});

app.listen(PORT, () => {
  console.log(`TechStock API running on port ${PORT}`);
});
