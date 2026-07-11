const { getAdminClient, sendTelegram, refId } = require('../lib/server');

function parseBkashSms(text) {
  const cashIn = text.match(/Cash In Tk\s*([\d,]+\.?\d*)\s*from\s*(\d+)\s*successful.*TrxID\s*(\w+)/is);
  if (cashIn) return { type: 'cash_in', amount: parseFloat(cashIn[1].replace(/,/g, '')), number: cashIn[2], trxId: cashIn[3] };

  const sendMoney = text.match(/received Tk\s*([\d,]+\.?\d*)\s*from\s*(\d+).*TrxID\s*(\w+)/is);
  if (sendMoney) return { type: 'send_money', amount: parseFloat(sendMoney[1].replace(/,/g, '')), number: sendMoney[2], trxId: sendMoney[3] };

  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { secret, message } = req.body || {};
  if (secret !== process.env.SMS_WEBHOOK_SECRET) return res.status(401).json({ error: 'Invalid secret' });
  if (!message) return res.status(400).json({ error: 'Message not found' });

  const parsed = parseBkashSms(message);
  if (!parsed) return res.status(200).json({ matched: false, reason: 'Unrecognized format' });

  const sb = getAdminClient();
  const { data: pending } = await sb
    .from('payments')
    .select('*')
    .eq('status', 'pending')
    .eq('sender_number', parsed.number)
    .eq('total_paid', parsed.amount);

  if (!pending || pending.length === 0) {
    return res.status(200).json({ matched: false, parsed });
  }

  const match = pending.find(p => p.trx_id && p.trx_id.toUpperCase() === parsed.trxId.toUpperCase()) || pending[0];

  await sb.from('payments').update({
    status: 'approved',
    verification_type: 'auto_sms',
    trx_id: parsed.trxId,
    admin_note: `Automatically verified via bKash SMS matching.`
  }).eq('id', match.id);

  const id = refId();
  await sb.from('activity_logs').insert([{
    ref_id: id,
    action: 'Auto Payment Verify',
    details: `Payment of ৳${parsed.amount} by ${match.payer_name} (TrxID ${parsed.trxId}) auto-approved.`
  }]);
  await sendTelegram(`✅ <b>Auto Verify Successful</b>\n👤 ${match.payer_name}\n💵 ৳${parsed.amount}\n🧾 TrxID: ${parsed.trxId}\n🔑 Ref: #${id}`);

  return res.status(200).json({ matched: true, paymentId: match.id });
};