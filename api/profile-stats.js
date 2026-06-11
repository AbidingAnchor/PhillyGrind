import { getUserFromRequest, hasServerSupabaseConfig, requireMethod, sendJson, supabaseAdmin } from './_utils.js';

export default async function handler(req, res) {
  if (!requireMethod(req, res, 'GET')) return;

  if (!hasServerSupabaseConfig) {
    sendJson(res, 500, { error: 'Server Supabase configuration is missing.' });
    return;
  }

  const viewer = await getUserFromRequest(req);
  if (!viewer) {
    sendJson(res, 401, { error: 'Authentication required.' });
    return;
  }

  const userId = req.query.user_id;
  if (!userId) {
    sendJson(res, 400, { error: 'user_id is required.' });
    return;
  }

  try {
    const { count, error } = await supabaseAdmin
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .or(`worker_id.eq.${userId},hirer_id.eq.${userId}`);

    if (error) throw error;

    sendJson(res, 200, { completedCount: count ?? 0 });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not load profile stats.' });
  }
}
