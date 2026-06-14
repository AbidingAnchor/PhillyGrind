import { hasSupabaseConfig, supabase } from './supabase.js';

async function getAccessToken() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error('Please log in first.');
  }

  return data.session.access_token;
}

async function attachApplicantProfiles(applications) {
  const applicantIds = [...new Set((applications ?? []).map((application) => application.applicant_id).filter(Boolean))];
  if (!applicantIds.length) return applications ?? [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,email')
    .in('id', applicantIds);

  if (error) throw error;

  const profilesById = new Map((data ?? []).map((profile) => [profile.id, profile]));
  return (applications ?? []).map((application) => ({
    ...application,
    applicantName: profilesById.get(application.applicant_id)?.name || 'PhillyGrind user',
    applicantEmail: profilesById.get(application.applicant_id)?.email || '',
  }));
}

export async function submitApplication({ jobId, coverNote, resumeUrl }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  if (!resumeUrl) {
    throw new Error('Please upload a resume before applying.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before applying.');
  }

  const { data, error } = await supabase
    .from('applications')
    .insert({
      job_id: jobId,
      applicant_id: userData.user.id,
      resume_url: resumeUrl,
      cover_note: coverNote?.trim() || null,
      status: 'pending',
    })
    .select('id,job_id,applicant_id,resume_url,cover_note,status,created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('You already applied to this job.');
    }

    throw error;
  }

  return data;
}

export async function getApplicationsForJob(jobId) {
  if (!hasSupabaseConfig || !jobId) return [];

  const { data, error } = await supabase
    .from('applications')
    .select('id,job_id,applicant_id,resume_url,cover_note,status,created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return attachApplicantProfiles(data ?? []);
}

export async function getMyApplications() {
  if (!hasSupabaseConfig) return [];

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in first.');
  }

  const { data, error } = await supabase
    .from('applications')
    .select('id,job_id,applicant_id,resume_url,cover_note,status,created_at')
    .eq('applicant_id', userData.user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const jobIds = [...new Set(data.map((application) => application.job_id))];
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id,title,category,neighborhood,company')
    .in('id', jobIds);

  if (jobsError) throw jobsError;

  const jobsById = Object.fromEntries((jobs ?? []).map((job) => [job.id, job]));
  return data.map((application) => ({
    ...application,
    job: jobsById[application.job_id],
  }));
}

export async function getApplicationResumeUrl(applicationId) {
  const token = await getAccessToken();
  const response = await fetch(`/api/application-resume?application_id=${encodeURIComponent(applicationId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load resume.');
  }

  return payload.signedUrl;
}
