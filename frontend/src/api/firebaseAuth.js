// Firebase Auth REST API — no SDK needed
const API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const BASE = 'https://identitytoolkit.googleapis.com/v1';

// Send OTP to phone number (E.164 format: +91XXXXXXXXXX)
export async function sendOtp(phoneNumber) {
  const res = await fetch(`${BASE}/accounts:sendVerificationCode?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phoneNumber,
      recaptchaToken: 'test', // works only for test numbers in Firebase console
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Failed to send OTP');
  return data.sessionInfo;
}

// Verify OTP — returns idToken
export async function verifyOtp(sessionInfo, code) {
  const res = await fetch(`${BASE}/accounts:signInWithPhoneNumber?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionInfo, code }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || 'Invalid OTP');
  return data.idToken;
}
