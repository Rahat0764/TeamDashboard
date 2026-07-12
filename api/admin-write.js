const { getAdminClient, requireAdmin, sendTelegram, refId } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req)) return res.status(401).json({ error: 'Session expired, please login again' });

  const sb = getAdminClient();
  const { action, payload } = req.body || {};

  try {
    switch (action) {
      case 'update_app_settings':
        await sb.from('app_settings').upsert({ id: 1, ...payload }).throwOnError();
        return res.status(200).json({ ok: true });
      case 'create_team':
        const { data: tData } = await sb.from('teams').insert([{ ...payload, status: 'approved' }]).select().throwOnError();
        await logAndNotify(sb, 'New Team Added', `Team ${payload.team_name} added.`);
        return res.status(200).json({ data: tData });
      case 'update_team':
        const { id: uId, ...tFields } = payload;
        await sb.from('teams').update(tFields).eq('id', uId).throwOnError();
        return res.status(200).json({ ok: true });
      case 'approve_team':
        await sb.from('teams').update({ status: 'approved' }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_team':
        await sb.from('teams').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'create_match':
        const { data: mData } = await sb.from('matches').insert([payload]).select().throwOnError();
        return res.status(200).json({ data: mData });
      case 'delete_match':
        await sb.from('matches').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'upsert_result':
        await sb.from('match_results').upsert([payload], { onConflict: 'match_id,team_id' }).throwOnError();
        return res.status(200).json({ ok: true });
      case 'update_point_settings':
        await sb.from('point_settings').upsert({ id: 1, ...payload }).throwOnError();
        return res.status(200).json({ ok: true });
      case 'update_bkash_numbers':
        await sb.from('bkash_numbers').upsert({ id: 1, numbers: payload.numbers }).throwOnError();
        return res.status(200).json({ ok: true });
      case 'approve_payment':
        await sb.from('payments').update({ status: 'approved' }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'reject_payment':
        await sb.from('payments').update({ status: 'rejected' }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_log':
        await sb.from('activity_logs').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
        
      case 'create_tournament':
        await sb.from('tournaments').insert([payload]).throwOnError();
        return res.status(200).json({ ok: true });
      case 'update_tournament':
        const { id: trId, ...trFields } = payload;
        await sb.from('tournaments').update(trFields).eq('id', trId).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_tournament':
        await sb.from('tournaments').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_payment':
        await sb.from('payments').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      
      case 'approve_player':
        await sb.from('players').update({ status: 'approved' }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'update_player':
        const { id: pId, ...pFields } = payload;
        await sb.from('players').update(pFields).eq('id', pId).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_player':
        await sb.from('players').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      
      case 'approve_stat':
        await sb.from('player_stats').update({ status: 'approved' }).eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });
      case 'delete_stat':
        await sb.from('player_stats').delete().eq('id', payload.id).throwOnError();
        return res.status(200).json({ ok: true });

      case 'reset_all':
        await sb.from('player_stats').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('match_results').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await sb.from('activity_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000').throwOnError();
        await logAndNotify(sb, 'FULL RESET', 'Admin performed a full dashboard reset. All data wiped.');
        return res.status(200).json({ ok: true });

      default:
        return res.status(400).json({ error: 'Unknown command' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

async function logAndNotify(sb, action, details) {
  const id = refId();
  await sb.from('activity_logs').insert([{ ref_id: id, action, details }]);
  await sendTelegram(`🔔 <b>${action}</b>\n📝 ${details}\n🔑 Ref: #${id}`);
}