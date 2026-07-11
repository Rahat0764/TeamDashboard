const { getAdminClient, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { tournament_id, team_id, payer_name, base_amount, calculated_fee, total_paid, trx_id, sender_number, screenshot_url, verify_method } = req.body || {};
  
  if (!total_paid || !payer_name) return res.status(400).json({ error: 'Name and amount are required' });

  const sb = getAdminClient();
  const row = {
    tournament_id: tournament_id || null,
    team_id: team_id || null,
    payer_name,
    amount: base_amount,
    calculated_fee,
    total_paid,
    trx_id: trx_id || null,
    sender_number: sender_number || null,
    screenshot_url: screenshot_url || null,
    status: 'pending',
    verification_type: verify_method === 'auto' ? 'auto_sms_requested' : 'manual'
  };

  const { data, error } = await sb.from('payments').insert([row]).select().single();
  if (error) return res.status(500).json({ error: error.message });

  const id = refId();
  const actionText = verify_method === 'auto' ? 'SMS Auto Verify Requested' : 'Manual Payment Submission';
  await sb.from('activity_logs').insert([{ ref_id: id, action: actionText, details: `${payer_name} submitted ৳${total_paid}, pending review.` }]);

  const domain = `https://${req.headers.host}`;
  const secret = process.env.CALLBACK_SECRET;
  const msg = `💰 <b>New Payment Submission</b>\n👤 Name: ${payer_name}\n💵 Total Paid: ৳${total_paid}\n🧾 TrxID: ${trx_id || '—'}\n📱 Number: ${sender_number || '—'}\n⚙️ Method: ${verify_method === 'auto' ? 'Auto SMS' : 'Manual'}\n🔑 Ref: #${id}${screenshot_url ? `\n🖼 Screenshot: ${screenshot_url}` : ''}`;
  
  await sendTelegram(msg, {
    inline_keyboard: [[
      { text: '✅ Approve', url: `${domain}/api/telegram-callback?action=approve&id=${data.id}&token=${secret}` },
      { text: '❌ Reject', url: `${domain}/api/telegram-callback?action=reject&id=${data.id}&token=${secret}` }
    ]]
  });

  res.status(200).json({ ok: true, id: data.id });
};
