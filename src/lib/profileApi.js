import { hasSupabaseConfig, supabase } from './supabase.js';

const avatarExtensionFor = (file) => (file.type === 'image/png' ? 'png' : 'jpg');
const bannerExtensionFor = (file) => {
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  return 'jpg';
};
const profileSelect = 'id,name,bio,skills,availability,neighborhoods,resume_path,resume_url,avatar_url,banner_url,profile_tags,accent_color,created_at,account_reference';
const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export async function updateProfile({ name, bio, skills, availability, neighborhoods, profile_tags, accent_color, neighborhood }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before editing your profile.');
  }

  // Get current profile to check if name is changing
  const { data: currentProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', userData.user.id)
    .single();

  if (fetchError) throw fetchError;

  // Log name change if different
  if (currentProfile && currentProfile.name !== name) {
    await supabase
      .from('name_history')
      .insert({
        user_id: userData.user.id,
        old_name: currentProfile.name,
        new_name: name,
      });
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      name,
      bio,
      skills,
      availability,
      neighborhoods,
      profile_tags,
      accent_color,
      neighborhood,
    })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  console.log('[Profile API] Update profile response:', { error, data, accent_color: data?.accent_color });

  if (error) throw error;

  return data;
}

export async function uploadResume(file) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    throw new Error('Please log in before uploading a resume.');
  }

  if (!ALLOWED_RESUME_TYPES.includes(file.type)) {
    throw new Error('Resume must be a PDF or Word document (.pdf, .doc, .docx).');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Resume must be 5MB or smaller.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/resume?action=upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionData.session.access_token}`,
    },
    body: formData,
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Could not upload resume.');
  }

  return payload.profile;
}

export async function getResumeUrl(resumePath) {
  if (!hasSupabaseConfig || !resumePath) return null;

  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(resumePath, 300);

  if (error) throw error;

  return data.signedUrl;
}

export async function removeResume() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before removing your resume.');
  }

  const { data: currentProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('resume_path')
    .eq('id', userData.user.id)
    .single();

  if (fetchError) throw fetchError;

  if (!currentProfile?.resume_path) {
    throw new Error('No resume to remove.');
  }

  // Remove file from storage
  const { error: storageError } = await supabase.storage
    .from('resumes')
    .remove([currentProfile.resume_path]);

  if (storageError) throw storageError;

  // Clear resume path from profile
  const { data, error } = await supabase
    .from('profiles')
    .update({ resume_path: null, resume_url: null })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) throw error;

  return data;
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

export async function uploadBanner(file) {
  console.log('[uploadBanner] Starting banner upload for file:', file.name, file.size, file.type);
  
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading a banner photo.');
  }
  
  console.log('[uploadBanner] User authenticated:', userData.user.id);

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Banner photo must be a JPG, PNG, or WebP.');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Banner photo must be 5MB or smaller.');
  }

  const path = `${userData.user.id}/banner.${bannerExtensionFor(file)}`;
  console.log('[uploadBanner] Storage path:', path);
  
  const { error: uploadError } = await supabase.storage
    .from('profile-banners')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[uploadBanner] Storage upload error:', uploadError);
    throw uploadError;
  }
  
  console.log('[uploadBanner] Storage upload successful');

  const { data: publicData } = supabase.storage
    .from('profile-banners')
    .getPublicUrl(path);

  console.log('[uploadBanner] Public URL generated:', publicData.publicUrl);

  const { data, error } = await supabase
    .from('profiles')
    .update({ banner_url: publicData.publicUrl })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error('[uploadBanner] Database update error:', error);
    throw error;
  }
  
  console.log('[uploadBanner] Database update successful, banner_url:', data.banner_url);

  return data;
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
