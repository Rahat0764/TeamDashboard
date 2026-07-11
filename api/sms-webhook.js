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
  if (secret !== process.env.SMS_WEBHOOK_SECRET) return res.status(401).json({ error: 'ভুল সিক্রেট' });
  if (!message) return res.status(400).json({ error: 'ম্যাসেজ পাওয়া যায়নি' });

  const parsed = parseBkashSms(message);
  if (!parsed) return res.status(200).json({ matched: false, reason: 'এই ফরম্যাটের ম্যাসেজ চেনা যায়নি' });

  const sb = getAdminClient();
  const { data: pending } = await sb
    .from('payments')
    .select('*')
    .eq('status', 'pending')
    .eq('sender_number', parsed.number)
    .eq('amount', parsed.amount);

  if (!pending || pending.length === 0) {
    return res.status(200).json({ matched: false, parsed });
  }

  const match = pending.find(p => p.trx_id && p.trx_id.toUpperCase() === parsed.trxId.toUpperCase()) || pending[0];

  await sb.from('payments').update({
    status: 'approved',
    verification_type: 'auto_sms',
    trx_id: parsed.trxId,
    admin_note: `bKash SMS মিলে যাওয়ায় স্বয়ংক্রিয়ভাবে অ্যাপ্রুভ হয়েছে।`
  }).eq('id', match.id);

  const id = refId();
  await sb.from('activity_logs').insert([{
    ref_id: id,
    action: 'স্বয়ংক্রিয় পেমেন্ট ভেরিফাই',
    details: `${match.payer_name} এর ৳${parsed.amount} (TrxID ${parsed.trxId}) SMS মিলিয়ে স্বয়ংক্রিয়ভাবে অ্যাপ্রুভ হয়েছে।`
  }]);
  await sendTelegram(`✅ <b>স্বয়ংক্রিয় ভেরিফাই সম্পন্ন</b>\n👤 ${match.payer_name}\n💵 ৳${parsed.amount}\n🧾 TrxID: ${parsed.trxId}\n🔑 Ref: #${id}`);

  return res.status(200).json({ matched: true, paymentId: match.id });
};
