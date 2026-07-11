const { getAdminClient, refId } = require('../lib/server');

function page(title, message, ok) {
  const color = ok ? '#10b981' : '#ef4444';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
    .card{background:#1e293b;border:1px solid #334155;border-radius:24px;padding:36px;max-width:360px;text-align:center}
    h1{color:${color};font-size:22px;margin:0 0 10px}
    p{color:#94a3b8;font-size:14px;line-height:1.6}
  </style></head>
  <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`;
}

module.exports = async (req, res) => {
  const { action, id, token } = req.query;
  res.setHeader('Content-Type', 'text/html');

  if (token !== process.env.CALLBACK_SECRET) {
    return res.status(401).send(page('Invalid Token', 'This link is not valid.', false));
  }
  if (!id || !action) {
    return res.status(400).send(page('Incomplete Link', 'ID or action missing.', false));
  }

  const sb = getAdminClient();
  
  const { data: existing } = await sb.from('payments').select('status').eq('id', id).single();
  if (existing && existing.status !== 'pending') {
    return res.status(400).send(page('Already Processed', `This payment is already ${existing.status}.`, false));
  }

  const status = action === 'approve' ? 'approved' : 'rejected';
  const { error } = await sb.from('payments').update({ status }).eq('id', id);
  if (error) return res.status(500).send(page('Error', error.message, false));

  await sb.from('activity_logs').insert([{
    ref_id: refId(),
    action: action === 'approve' ? 'Payment Approved (TG)' : 'Payment Rejected (TG)',
    details: `Ref #${id} was ${action === 'approve' ? 'approved' : 'rejected'}.`
  }]);

  return res.status(200).send(
    action === 'approve'
      ? page('✅ Approved', 'The payment was successfully approved. You can return to the website.', true)
      : page('❌ Rejected', 'The payment has been rejected.', false)
  );
};