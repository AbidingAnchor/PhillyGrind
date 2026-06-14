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

  const applicationId = req.query.application_id;
  if (!applicationId) {
    sendJson(res, 400, { error: 'application_id is required.' });
    return;
  }

  try {
    const { data: application, error: applicationError } = await supabaseAdmin
      .from('applications')
      .select('id,applicant_id,resume_url,job_id')
      .eq('id', applicationId)
      .maybeSingle();

    if (applicationError) throw applicationError;
    if (!application) {
      sendJson(res, 404, { error: 'Application not found.' });
      return;
    }

    const isApplicant = application.applicant_id === viewer.id;
    let isJobPoster = false;

    if (!isApplicant) {
      const { data: job, error: jobError } = await supabaseAdmin
        .from('jobs')
        .select('user_id')
        .eq('id', application.job_id)
        .maybeSingle();

      if (jobError) throw jobError;
      isJobPoster = job?.user_id === viewer.id;
    }

    if (!isApplicant && !isJobPoster) {
      sendJson(res, 403, { error: 'You do not have access to this resume.' });
      return;
    }

    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from('resumes')
      .createSignedUrl(application.resume_url, 300);

    if (signedError) throw signedError;

    sendJson(res, 200, { signedUrl: signedData.signedUrl });
  } catch (error) {
    sendJson(res, 500, { error: error.message || 'Could not load resume.' });
  }
}
