const { getAdminClient, sendTelegram, refId, verify } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  
  if (JSON.stringify(req.body).length > 50000) return res.status(400).json({error: 'Payload too large'});

  const sb = getAdminClient();
  const { action, payload } = req.body || {};
  
  const token = req.headers['x-admin-token'];
  const tokenPayload = verify(token);
  const isAdmin = !!(tokenPayload && tokenPayload.role === 'admin');

  try {
    if (action === 'submit_team') {
      const { data, error } = await sb.from('teams').insert([{ ...payload, status: 'pending' }]).select().single();
      if (error) throw error;
      
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Team Request', details: `${payload.team_name} requested to register.` }]);
      await sendTelegram(`🛡️ <b>New Team Request</b>\nName: ${payload.team_name}\nManager: ${payload.manager_name}\nRef: #${id}`);
      return res.status(200).json({ ok: true });
    }

    if (action === 'submit_player') {
      const { data, error } = await sb.from('players').insert([{ ...payload, status: 'pending' }]).select().single();
      if (error) throw error;
      
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Player Request', details: `${payload.name} requested to join a team.` }]);
      await sendTelegram(`👤 <b>New Player Request</b>\nName: ${payload.name}\nUID: ${payload.uid}\nRole: ${payload.role}\nRef: #${id}`);
      return res.status(200).json({ ok: true });
    }
    
    if (action === 'submit_stats') {
      let match_id = payload.match_id;
      
      if (payload.match_label) {
        const { data: m } = await sb.from('matches').select('id').eq('match_label', payload.match_label).single();
        if (m) {
            match_id = m.id;
        } else {
            const { data: nm } = await sb.from('matches').insert([{ match_no: Date.now()%10000, match_label: payload.match_label }]).select('id').single();
            if(nm) match_id = nm.id;
        }
      }
      
      const statStatus = isAdmin ? 'approved' : 'pending';

      const { data, error } = await sb.from('player_stats').insert([{ 
          match_id, 
          player_id: payload.player_id, 
          team_id: payload.team_id,
          kills: payload.kills,
          assists: payload.assists,
          damage: payload.damage,
          survived_minutes: payload.survived_minutes,
          screenshot_url: payload.screenshot_url,
          status: statStatus 
      }]).select().single();
      
      if (error) throw error;
      
      if (!isAdmin) {
          const id = refId();
          await sb.from('activity_logs').insert([{ ref_id: id, action: 'Stats Submission', details: `Match stats submitted for review.` }]);
          await sendTelegram(`📊 <b>New Stats Submission</b>\nKills: ${payload.kills} | Dmg: ${payload.damage}\nRef: #${id}`);
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
