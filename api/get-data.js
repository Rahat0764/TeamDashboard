const { getAdminClient, verify } = require('../lib/server');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers['x-admin-token'];
  const payload = verify(token);
  const isAdmin = !!(payload && payload.role === 'admin');

  const sb = getAdminClient();

  try {
    const [
      teamsRes,
      matchesRes,
      resultsRes,
      paymentsRes,
      logsRes,
      numbersRes,
      appSettingsRes,
      tournamentsRes,
      playersRes,
      statsRes
    ] = await Promise.all([
      sb.from('teams').select('*').order('created_at', { ascending: true }),
      sb.from('matches').select('*').order('match_no', { ascending: true }),
      sb.from('match_results').select('*'),
      sb.from('payments').select('*').order('created_at', { ascending: false }),
      sb.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(50),
      sb.from('bkash_numbers').select('*').eq('id', 1).single(),
      sb.from('app_settings').select('*').eq('id', 1).single(),
      sb.from('tournaments').select('*').order('created_at', { ascending: false }),
      isAdmin
        ? sb.from('players').select('*').order('created_at', { ascending: false })
        : sb.from('players').select('*').eq('status', 'approved'),
      isAdmin
        ? sb.from('player_stats').select('*').order('created_at', { ascending: false })
        : sb.from('player_stats').select('*').eq('status', 'approved')
    ]);

    const errs = [teamsRes, matchesRes, resultsRes, paymentsRes, logsRes, numbersRes, appSettingsRes, tournamentsRes, playersRes, statsRes].map(r => r.error).filter(Boolean);
    if (errs.length) throw errs[0];

    return res.status(200).json({
      teams: teamsRes.data || [],
      matches: matchesRes.data || [],
      results: resultsRes.data || [],
      payments: paymentsRes.data || [],
      logs: logsRes.data || [],
      numbers: (numbersRes.data && numbersRes.data.numbers) || [],
      appSettings: appSettingsRes.data || null,
      tournaments: tournamentsRes.data || [],
      players: playersRes.data || [],
      player_stats: statsRes.data || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};