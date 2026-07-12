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
      return res.status(200).json({ ok: true, data });
    }

    if (action === 'submit_team_with_players') {
      const { data: newTeam, error: tErr } = await sb.from('teams').insert([{ ...payload.team, status: 'pending' }]).select().single();
      if (tErr) throw tErr;

      if (payload.players && payload.players.length > 0) {
        const pData = payload.players.map(p => ({ ...p, team_id: newTeam.id, status: 'pending' }));
        const { error: pErr } = await sb.from('players').insert(pData);
        if (pErr) throw pErr;
      }
      
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Team Request', details: `${payload.team.team_name} requested to register with players.` }]);
      await sendTelegram(`🛡️ <b>New Team & Players Request</b>\nName: ${payload.team.team_name}\nPlayers: ${payload.players?.length || 0}\nRef: #${id}`);
      return res.status(200).json({ ok: true, data: newTeam });
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

    if (action === 'free_registration') {
      const { data: tour, error: tErr } = await sb.from('tournaments').select('entry_fee, title').eq('id', payload.tournament_id).single();
      if (tErr || !tour) throw new Error('Tournament not found');
      if (Number(tour.entry_fee) !== 0) throw new Error('Not a free tournament');
      
      const { data: exist } = await sb.from('payments').select('id').eq('tournament_id', payload.tournament_id).eq('team_id', payload.team_id).eq('status', 'approved');
      if(exist && exist.length > 0) throw new Error('Team is already registered');

      const { data: teamData } = await sb.from('teams').select('team_name').eq('id', payload.team_id).single();

      await sb.from('payments').insert([{
        tournament_id: payload.tournament_id,
        team_id: payload.team_id,
        payer_name: teamData ? `Team ${teamData.team_name}` : 'Free Registration',
        amount: 0, total_paid: 0, status: 'approved', verification_type: 'auto_free'
      }]).throwOnError();
      
      const id = refId();
      await sb.from('activity_logs').insert([{ ref_id: id, action: 'Free Registration', details: `${teamData ? teamData.team_name : 'A team'} registered for ${tour.title}.` }]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};