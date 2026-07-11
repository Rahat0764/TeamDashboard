const { getAdminClient, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  if (JSON.stringify(req.body).length > 50000) return res.status(400).json({error: 'Payload too large'});

  const sb = getAdminClient();
  const { action, payload } = req.body || {};

  try {
    if (action === 'submit_player') {
      const { data, error } = await sb.from('players').insert([{ ...payload, status: 'pending' }]).select().single();
      if (error) throw error;
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Player Request', details: `${payload.name} requested to join a team.` }]);
      await sendTelegram(`👤 <b>New Player Request</b>\nName: ${payload.name}\nUID: ${payload.uid}\nRole: ${payload.role}\nRef: #${id}`);
      return res.status(200).json({ ok: true });
    }
    
    if (action === 'submit_stats') {
      const { data, error } = await sb.from('player_stats').insert([{ ...payload, status: 'pending' }]).select().single();
      if (error) throw error;
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Stats Submission', details: `Match stats submitted for review.` }]);
      await sendTelegram(`📊 <b>New Stats Submission</b>\nKills: ${payload.kills} | Dmg: ${payload.damage}\nRef: #${id}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};