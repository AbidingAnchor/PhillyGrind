import { hasSupabaseConfig, supabase } from './supabase.js';

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MAX_EDGE = 1024;
const BANNER_MAX_EDGE = 1920;
const IMAGE_ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
]);
const profileSelect = 'id,name,bio,skills,availability,neighborhood,neighborhoods,resume_path,resume_url,avatar_url,banner_url,profile_tags,created_at,account_reference';

function displayNameFromUser(user) {
  return user?.user_metadata?.name
    || String(user?.email || '').split('@')[0]
    || 'Neighbor';
}

export async function ensureOwnProfile() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in first.');
  }

  const user = userData.user;

  const existing = await supabase
    .from('profiles')
    .select(profileSelect)
    .eq('id', user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const { data: rpcData, error: rpcError } = await supabase.rpc('ensure_own_profile');
  if (!rpcError && rpcData) {
    const created = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    if (created?.id) return created;
  }

  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      name: displayNameFromUser(user),
      email: user.email || '',
      tos_agreed_at: user.user_metadata?.tos_agreed_at || null,
      onboarding_complete: false,
      is_adult_confirmed: false,
    })
    .select(profileSelect)
    .single();

  if (error) {
    const retry = await supabase
      .from('profiles')
      .select(profileSelect)
      .eq('id', user.id)
      .maybeSingle();
    if (retry.data) return retry.data;
    throw error;
  }

  return data;
}

const ALLOWED_RESUME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function inferImageMime(file) {
  const typed = String(file?.type || '').toLowerCase();
  if (IMAGE_ALLOWED_TYPES.has(typed)) {
    return typed === 'image/jpg' || typed === 'image/pjpeg' ? 'image/jpeg' : typed;
  }

  const name = String(file?.name || '').toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  return '';
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo. Try a JPG or PNG instead.'));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not process that photo. Try a different image.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Normalize mobile/desktop photo picks into a JPEG/PNG under the storage size gate.
 * Phone camera files are often 3–12MB (or empty MIME / HEIC) and previously failed the hard checks.
 */
async function prepareProfileImageFile(file, { maxEdge, outputBase, noun }) {
  const mime = inferImageMime(file);
  const rawType = String(file?.type || '').toLowerCase();

  if (rawType.includes('heic') || rawType.includes('heif') || /\.heic$|\.heif$/i.test(file?.name || '')) {
    throw new Error('HEIC photos are not supported. On iPhone, use Settings → Camera → Formats → Most Compatible, or export the photo as JPG.');
  }

  if (!mime) {
    throw new Error(`${noun} must be a JPG, PNG, or WebP.`);
  }

  // Small files that are already allowed can skip canvas work (faster on desktop).
  if (file.size <= IMAGE_MAX_BYTES && (mime === 'image/jpeg' || mime === 'image/png')) {
    const extension = mime === 'image/png' ? 'png' : 'jpg';
    return new File([file], `${outputBase}.${extension}`, {
      type: mime,
      lastModified: Date.now(),
    });
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width || 1, image.height || 1));
  const width = Math.max(1, Math.round((image.width || 1) * scale));
  const height = Math.max(1, Math.round((image.height || 1) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    throw new Error('Could not process that photo on this device.');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let quality = 0.85;
  let blob = await canvasToJpegBlob(canvas, quality);
  while (blob.size > IMAGE_MAX_BYTES && quality > 0.45) {
    quality -= 0.1;
    blob = await canvasToJpegBlob(canvas, quality);
  }

  if (blob.size > IMAGE_MAX_BYTES) {
    throw new Error('That photo is still too large after compression. Try a smaller image.');
  }

  return new File([blob], `${outputBase}.jpg`, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });
}

function prepareAvatarFile(file) {
  return prepareProfileImageFile(file, {
    maxEdge: AVATAR_MAX_EDGE,
    outputBase: 'avatar',
    noun: 'Profile photo',
  });
}

function prepareBannerFile(file) {
  return prepareProfileImageFile(file, {
    maxEdge: BANNER_MAX_EDGE,
    outputBase: 'banner',
    noun: 'Banner photo',
  });
}

export async function updateProfile({ name, bio, skills, availability, neighborhoods, profile_tags, neighborhood }) {
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
      neighborhood,
    })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  console.log('[Profile API] Update profile response:', { error, data });

  if (error) throw error;

  return data;
}

export async function completeOwnOnboarding(neighborhood) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.rpc('complete_own_onboarding', {
    p_neighborhood: neighborhood || null,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function touchOwnLastActive() {
  if (!hasSupabaseConfig) return;

  const { error } = await supabase.rpc('touch_own_last_active');
  if (error) throw error;
}

export async function clearOwnResumeRecord() {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data, error } = await supabase.rpc('clear_own_resume');
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
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

  const data = await clearOwnResumeRecord();
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

  console.log('[uploadAvatar] Incoming file:', {
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });

  const prepared = await prepareAvatarFile(file);
  console.log('[uploadAvatar] Prepared file:', {
    name: prepared.name,
    type: prepared.type,
    size: prepared.size,
  });

  const extension = prepared.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userData.user.id}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, prepared, {
      cacheControl: '3600',
      contentType: prepared.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[uploadAvatar] Storage upload failed:', uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  // Same storage path on every upload — bust browser/CDN cache or the old photo sticks.
  const cacheBustedUrl = `${publicData.publicUrl}?v=${Date.now()}`;
  console.log('[uploadAvatar] Updating profile avatar_url:', cacheBustedUrl);

  const { data, error } = await supabase
    .from('profiles')
    .update({ avatar_url: cacheBustedUrl })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error('[uploadAvatar] Profile update failed:', error);
    throw error;
  }

  console.log('[uploadAvatar] Profile updated successfully:', data?.avatar_url);
  return data;
}

export async function uploadBanner(file) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading a banner photo.');
  }

  console.log('[uploadBanner] Incoming file:', {
    name: file?.name,
    type: file?.type,
    size: file?.size,
  });

  const prepared = await prepareBannerFile(file);
  console.log('[uploadBanner] Prepared file:', {
    name: prepared.name,
    type: prepared.type,
    size: prepared.size,
  });

  const extension = prepared.type === 'image/png' ? 'png' : 'jpg';
  const path = `${userData.user.id}/banner.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('profile-banners')
    .upload(path, prepared, {
      cacheControl: '3600',
      contentType: prepared.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[uploadBanner] Storage upload failed:', uploadError);
    throw uploadError;
  }

  const { data: publicData } = supabase.storage
    .from('profile-banners')
    .getPublicUrl(path);

  // Same storage path on every upload — bust browser/CDN cache or the old photo sticks.
  const cacheBustedUrl = `${publicData.publicUrl}?v=${Date.now()}`;
  console.log('[uploadBanner] Updating profile banner_url:', cacheBustedUrl);

  const { data, error } = await supabase
    .from('profiles')
    .update({ banner_url: cacheBustedUrl })
    .eq('id', userData.user.id)
    .select(profileSelect)
    .single();

  if (error) {
    console.error('[uploadBanner] Profile update failed:', error);
    throw error;
  }

  console.log('[uploadBanner] Profile updated successfully:', data?.banner_url);
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
