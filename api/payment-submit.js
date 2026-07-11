const { getAdminClient, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { team_id, payer_name, amount, trx_id, sender_number, screenshot_url } = req.body || {};
  if (!amount || !payer_name) return res.status(400).json({ error: 'নাম এবং পরিমাণ আবশ্যক' });

  const sb = getAdminClient();
  const row = {
    team_id: team_id || null,
    payer_name,
    amount,
    trx_id: trx_id || null,
    sender_number: sender_number || null,
    screenshot_url: screenshot_url || null,
    status: 'pending',
    verification_type: 'manual'
  };

  const { data, error } = await sb.from('payments').insert([row]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const id = refId();
  await sb.from('activity_logs').insert([{ ref_id: id, action: 'পেমেন্ট সাবমিট', details: `${payer_name} ৳${amount} সাবমিট করেছে, রিভিউ বাকি।` }]);

  const domain = `https://${req.headers.host}`;
  const secret = process.env.CALLBACK_SECRET;
  const msg = `💰 <b>নতুন পেমেন্ট সাবমিশন</b>\n👤 নাম: ${payer_name}\n💵 পরিমাণ: ৳${amount}\n🧾 TrxID: ${trx_id || '—'}\n📱 নাম্বার: ${sender_number || '—'}\n🔑 Ref: #${id}${screenshot_url ? `\n🖼 স্ক্রিনশট: ${screenshot_url}` : ''}`;
  await sendTelegram(msg, {
    inline_keyboard: [[
      { text: '✅ Approve', url: `${domain}/api/telegram-callback?action=approve&id=${data.id}&token=${secret}` },
      { text: '❌ Reject', url: `${domain}/api/telegram-callback?action=reject&id=${data.id}&token=${secret}` }
    ]]
  });

  res.status(200).json({ ok: true, id: data.id });
};
