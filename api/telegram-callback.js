const { getAdminClient, refId } = require('../lib/server');

function page(title, message, ok) {
  const color = ok ? '#16a34a' : '#e11d48';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0b0b10;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#16161f;border:1px solid #2a2a35;border-radius:24px;padding:36px;max-width:360px;text-align:center}
    h1{color:${color};font-size:22px;margin:0 0 10px}
    p{color:#9ca3af;font-size:14px;line-height:1.6}
  </style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

module.exports = async (req, res) => {
  const { action, id, token } = req.query;
  res.setHeader('Content-Type', 'text/html');

  if (token !== process.env.CALLBACK_SECRET) {
    return res.status(401).send(page('ভুল টোকেন', 'এই লিংকটি বৈধ নয়।', false));
  }
  if (!id || !action) {
    return res.status(400).send(page('অসম্পূর্ণ লিংক', 'আইডি অথবা অ্যাকশন পাওয়া যায়নি।', false));
  }

  const sb = getAdminClient();
  const status = action === 'approve' ? 'approved' : 'rejected';
  const { error } = await sb.from('payments').update({ status }).eq('id', id);
  if (error) return res.status(500).send(page('এরর', error.message, false));

  await sb.from('activity_logs').insert([{
    ref_id: refId(),
    action: action === 'approve' ? 'পেমেন্ট অ্যাপ্রুভ (টেলিগ্রাম)' : 'পেমেন্ট রিজেক্ট (টেলিগ্রাম)',
    details: `Ref #${id} ${action === 'approve' ? 'অ্যাপ্রুভ' : 'রিজেক্ট'} করা হয়েছে।`
  }]);

  return res.status(200).send(
    action === 'approve'
      ? page('✅ অ্যাপ্রুভড', 'পেমেন্টটি সফলভাবে অ্যাপ্রুভ করা হয়েছে। ওয়েবসাইটে ফিরে যান।', true)
      : page('❌ রিজেক্টেড', 'পেমেন্টটি বাতিল করা হয়েছে।', false)
  );
};
