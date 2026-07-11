// filepath: api/admin-login.js
const { sign } = require('../lib/server');

module.exports = (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { password } = req.body || {};
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = sign({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 12 });
  res.status(200).json({ token });
};