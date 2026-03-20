# CricketWin — Cricket Prediction Platform

## Stack
- Backend: Node.js + Express + MongoDB + Mongoose
- Frontend: React + Vite + Tailwind CSS
- Payments: Razorpay
- Auth: JWT

## Setup

### 1. Backend
```bash
cd backend
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, RAZORPAY keys
npm install
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. Make yourself an admin
After registering, run:
```bash
cd backend
node scripts/makeAdmin.js your@email.com
```
Then log out and back in — you'll see the Admin link in the navbar.

## Features
- Register/Login with JWT
- Browse matches (Upcoming / Locked / Completed)
- Join contests by paying entry fee from wallet
- Razorpay wallet top-up
- Auto-lock matches via cron job (runs every minute)
- Admin: add matches, set results, view users & transactions
- Winnings auto-distributed on result (₹100 entry → ₹190 prize)

## Razorpay Test Mode
Use test credentials from your Razorpay dashboard.
Card: `4111 1111 1111 1111`, any future expiry, any CVV.
