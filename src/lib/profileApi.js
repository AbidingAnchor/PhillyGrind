import { hasSupabaseConfig, supabase } from './supabase.js';

const resumePathFor = (userId) => `${userId}/resume.pdf`;
const avatarExtensionFor = (file) => (file.type === 'image/png' ? 'png' : 'jpg');
const profileSelect = 'id,name,bio,skills,availability,neighborhoods,resume_path,avatar_url,created_at';

export async function updateProfile({ bio, skills, availability, neighborhoods }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before editing your profile.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      bio,
      skills,
      availability,
      neighborhoods,
    })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) throw error;

  return data;
}

export async function uploadResume(file) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading a resume.');
  }

  if (file.type !== 'application/pdf') {
    throw new Error('Resume must be a PDF.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Resume must be 5MB or smaller.');
  }

  const path = resumePathFor(userData.user.id);
  const { error: uploadError } = await supabase.storage
    .from('resumes')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('profiles')
    .update({ resume_path: path })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) throw error;

  return data;
}

export async function getResumeUrl(resumePath) {
  if (!hasSupabaseConfig || !resumePath) return null;

  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(resumePath, 60);

  if (error) throw error;

  return data.signedUrl;
}

export async function uploadAvatar(file) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading a profile photo.');
  }

  if (!['image/jpeg', 'image/png'].includes(file.type)) {
    throw new Error('Profile photo must be a JPG or PNG.');
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new Error('Profile photo must be 2MB or smaller.');
  }

  const path = `${userData.user.id}/avatar.${avatarExtensionFor(file)}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: publicData.publicUrl })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) throw error;

  return data;
}

export async function getPublicProfileStats(userId) {
  if (!hasSupabaseConfig || !userId) {
    return { completedCount: 0 };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Please log in to view this profile.');
  }

  const response = await fetch(`/api/profile-stats?user_id=${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not load profile stats.');
  }

  return payload;
}

export async function checkConnectStatus() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Please log in first.');
  }

  const response = await fetch('/api/stripe?action=check-connect-status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not check Stripe Connect status.');
  }

  return payload;
}
