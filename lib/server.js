const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function getAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('base64url');
  if (sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function requireAdmin(req) {
  const token = req.headers['x-admin-token'] || (req.body && req.body.token);
  const payload = verify(token);
  return payload && payload.role === 'admin';
}

async function sendTelegram(message, replyMarkup) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const payload = { chat_id: chatId, text: message, parse_mode: 'HTML' };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  try {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) {}
}

function refId() {
  return Math.random().toString(36).substr(2, 6).toUpperCase();
}

module.exports = { getAdminClient, sign, verify, requireAdmin, sendTelegram, refId };
