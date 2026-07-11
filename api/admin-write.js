// filepath: api/admin-write.js
const { getAdminClient, requireAdmin, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req)) return res.status(401).json({ error: 'Session expired, please login again' });

  const sb = getAdminClient();
  const { action, payload } = req.body || {};

  try {
    switch (action) {
      case 'update_app_settings': {
        const { error } = await sb.from('app_settings').update(payload).eq('id', 1);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'create_team': {
        const { data, error } = await sb.from('teams').insert([payload]).select();
        if (error) throw error;
        await logAndNotify(sb, 'New Team Added', `Team ${payload.team_name} has been added.`);
        return res.status(200).json({ data });
      }
      case 'update_team': {
        const { id, ...fields } = payload;
        const { data, error } = await sb.from('teams').update(fields).eq('id', id).select();
        if (error) throw error;
        await logAndNotify(sb, 'Team Updated', `Information for ${fields.team_name || 'a team'} was updated.`);
        return res.status(200).json({ data });
      }
      case 'delete_team': {
        const { id } = payload;
        await sb.from('match_results').delete().eq('team_id', id);
        const { error } = await sb.from('teams').delete().eq('id', id);
        if (error) throw error;
        await logAndNotify(sb, 'Team Removed', 'A team has been deleted.');
        return res.status(200).json({ ok: true });
      }
      case 'create_match': {
        const { data, error } = await sb.from('matches').insert([payload]).select();
        if (error) throw error;
        return res.status(200).json({ data });
      }
      case 'delete_match': {
        const { error } = await sb.from('matches').delete().eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'upsert_result': {
        const { data: settingsRow } = await sb.from('point_settings').select('*').eq('id', 1).single();
        const posTable = (settingsRow && settingsRow.position_table) || {};
        const killVal = (settingsRow && settingsRow.kill_point_value) || 1;
        const posPoints = posTable[String(payload.position)] ?? 0;
        const killPoints = Number(payload.kills || 0) * Number(killVal);
        const row = {
          match_id: payload.match_id,
          team_id: payload.team_id,
          position: payload.position,
          kills: payload.kills,
          position_points: posPoints,
          kill_points: killPoints,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await sb.from('match_results').upsert([row], { onConflict: 'match_id,team_id' }).select();
        if (error) throw error;
        return res.status(200).json({ data });
      }
      case 'update_point_settings': {
        const { error } = await sb.from('point_settings').update(payload).eq('id', 1);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'update_bkash_numbers': {
        const { error } = await sb.from('bkash_numbers').update({ numbers: payload.numbers }).eq('id', 1);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'approve_payment': {
        const { data: pay } = await sb.from('payments').select('*').eq('id', payload.id).single();
        const { error } = await sb.from('payments').update({ status: 'approved' }).eq('id', payload.id);
        if (error) throw error;
        if (pay) await logAndNotify(sb, 'Payment Approved', `Payment of ৳${pay.amount} by ${pay.payer_name || 'someone'} was approved.`);
        return res.status(200).json({ ok: true });
      }
      case 'reject_payment': {
        const { error } = await sb.from('payments').update({ status: 'rejected' }).eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      case 'delete_log': {
        const { error } = await sb.from('activity_logs').delete().eq('id', payload.id);
        if (error) throw error;
        return res.status(200).json({ ok: true });
      }
      default:
        return res.status(400).json({ error: 'Unknown command' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server Error' });
  }
};

async function logAndNotify(sb, action, details) {
  const id = refId();
  await sb.from('activity_logs').insert([{ ref_id: id, action, details }]);
  await sendTelegram(`🔔 <b>${action}</b>\n📝 ${details}\n🔑 Ref: #${id}`);
}