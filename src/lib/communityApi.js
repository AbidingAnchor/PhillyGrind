import { hasSupabaseConfig, supabase } from './supabase.js';
import { createListingWithModeration } from './adminApi.js';
import { normalizeReactionType } from './reactions.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMMUNITY_NEIGHBORHOODS = [
  'Fishtown',
  'Kensington',
  'South Philly',
  'North Philly',
  'West Philly',
  'Northeast Philly',
  'Center City',
  'Germantown',
  'Manayunk',
  'Other',
];

function safeDisplayName(value, fallback = 'PhillyGrind user') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

function formatRelativeTime(dateString) {
  if (!dateString) return 'Just now';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function normalizePost(post) {
  const profile = post.profiles || post.profile || {};
  const authorName = safeDisplayName(profile.name || post.authorName);
  return {
    ...post,
    authorName,
    posterName: authorName,
    authorAvatarUrl: profile.avatar_url || '',
    authorId: post.user_id,
    relativeTime: formatRelativeTime(post.created_at),
    like_count: post.like_count || 0, // Ensure like_count is never undefined
  };
}

async function attachAuthorInfo(posts) {
  const list = posts ?? [];
  if (!hasSupabaseConfig || !list.length) return list.map(normalizePost);

  const userIds = [...new Set(list.map((item) => item.user_id).filter(Boolean))];
  if (!userIds.length) return list.map(normalizePost);

  const { data, error } = await supabase
    .from('profiles')
    .select('id,name,avatar_url')
    .in('id', userIds);

  if (error) throw error;

  const profilesById = Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
  return list.map((post) => normalizePost({
    ...post,
    profiles: profilesById[post.user_id],
  }));
}

export function getCommunityPhotoPublicUrl(path) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!hasSupabaseConfig) return trimmed;

  const { data } = supabase.storage.from('community-photos').getPublicUrl(trimmed);
  return data.publicUrl;
}

export async function getCommunityPosts(filters = {}) {
  if (!hasSupabaseConfig) return [];

  const { neighborhood = 'Any' } = filters;

  let query = supabase
    .from('community_posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (neighborhood && neighborhood !== 'Any') {
    query = query.eq('neighborhood', neighborhood);
  }

  const { data, error } = await query;
  if (error) throw error;

  return attachAuthorInfo(data ?? []);
}

export async function getCommunityPost(id) {
  if (!hasSupabaseConfig || !uuidPattern.test(id)) return undefined;

  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return undefined;

  const [post] = await attachAuthorInfo([data]);
  return post;
}

export async function getCommunityComments(postId) {
  if (!hasSupabaseConfig || !uuidPattern.test(postId)) return [];

  const { data, error } = await supabase
    .from('community_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const comments = data ?? [];
  const userIds = [...new Set(comments.map((comment) => comment.user_id).filter(Boolean))];
  
  if (!userIds.length) {
    return comments.map((comment) => ({
      ...comment,
      authorName: 'PhillyGrind user',
      authorAvatarUrl: '',
    }));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id,name,avatar_url')
    .in('id', userIds);

  if (profileError) throw profileError;

  const profilesById = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
  
  return comments.map((comment) => ({
    ...comment,
    authorName: safeDisplayName(profilesById[comment.user_id]?.name),
    authorAvatarUrl: profilesById[comment.user_id]?.avatar_url || '',
    relativeTime: formatRelativeTime(comment.created_at),
  }));
}

export async function getCommunityLikeCount(postId) {
  if (!hasSupabaseConfig) return 0;

  const { count, error } = await supabase
    .from('community_post_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) throw error;
  return count ?? 0;
}

export async function getReactionBreakdown(postId) {
  if (!hasSupabaseConfig) return [];

  const { data, error } = await supabase
    .from('community_post_likes')
    .select('reaction_type')
    .eq('post_id', postId);

  if (error) throw error;

  const breakdown = {};
  (data || []).forEach((like) => {
    const type = normalizeReactionType(like.reaction_type) || 'like';
    breakdown[type] = (breakdown[type] || 0) + 1;
  });

  const result = Object.entries(breakdown)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  console.log('[getReactionBreakdown] postId:', postId, 'raw rows:', data, 'breakdown:', result);

  return result;
}

export async function getUserReaction(postId) {
  if (!hasSupabaseConfig) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from('community_post_likes')
    .select('reaction_type')
    .eq('post_id', postId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.reaction_type) return null;
  return normalizeReactionType(data.reaction_type);
}

export async function getUserLikeStatus(postId) {
  if (!hasSupabaseConfig) return false;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return false;

  const { data, error } = await supabase
    .from('community_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  return !!data;
}

export async function uploadCommunityPhoto(file, postId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in before uploading photos.');
  }

  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Photos must be JPG, PNG, or WebP.');
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Each photo must be 10MB or smaller.');
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userData.user.id}/${postId}/photo.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('community-photos')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from('community-photos')
    .getPublicUrl(path);

  return publicData.publicUrl;
}

export async function createCommunityPost(post, photoFile = null) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to post to the community.');
  }

  console.log('[createCommunityPost] Starting post creation:', { content: post.content, neighborhood: post.neighborhood, hasPhoto: !!photoFile });

  try {
    // Run content moderation and create post via API
    const { listing: moderatedPost, moderationStatus } = await createListingWithModeration('community', {
      content: post.content,
      neighborhood: post.neighborhood,
    });

    console.log('[createCommunityPost] Moderation API response:', { moderationStatus, postId: moderatedPost?.id });

    if (!moderatedPost || !moderatedPost.id) {
      throw new Error('Failed to create post: Invalid response from moderation API');
    }

    // Handle photo upload if provided
    if (photoFile) {
      console.log('[createCommunityPost] Uploading photo for post:', moderatedPost.id);
      const photoUrl = await uploadCommunityPhoto(photoFile, moderatedPost.id);

      const { data: updated, error: updateError } = await supabase
        .from('community_posts')
        .update({ photo_url: photoUrl })
        .eq('id', moderatedPost.id)
        .select('*')
        .single();

      if (updateError) {
        console.error('[createCommunityPost] Photo update error:', updateError);
        throw updateError;
      }
      console.log('[createCommunityPost] Photo uploaded successfully');
      const [normalized] = await attachAuthorInfo([updated]);
      return normalized;
    }

    const [normalized] = await attachAuthorInfo([moderatedPost]);
    console.log('[createCommunityPost] Post created successfully');
    return normalized;
  } catch (error) {
    console.error('[createCommunityPost] Error:', error);
    
    // Fallback: If moderation fails with rate limit, try direct creation
    if (error.message?.includes('Too Many Requests') || error.message?.includes('429')) {
      console.warn('[createCommunityPost] Moderation rate limit hit, attempting direct creation');
      
      const payload = {
        user_id: userData.user.id,
        content: post.content.trim(),
        neighborhood: post.neighborhood,
        photo_url: null,
        like_count: 0,
      };

      const { data, error: directError } = await supabase
        .from('community_posts')
        .insert(payload)
        .select('*')
        .single();

      if (directError) {
        console.error('[createCommunityPost] Direct creation also failed:', directError);
        throw new Error('Failed to create post: ' + directError.message);
      }

      if (photoFile) {
        const photoUrl = await uploadCommunityPhoto(photoFile, data.id);
        const { data: updated, error: updateError } = await supabase
          .from('community_posts')
          .update({ photo_url: photoUrl })
          .eq('id', data.id)
          .select('*')
          .single();

        if (updateError) throw updateError;
        const [normalized] = await attachAuthorInfo([updated]);
        return normalized;
      }

      const [normalized] = await attachAuthorInfo([data]);
      console.log('[createCommunityPost] Post created successfully via fallback');
      return normalized;
    }
    
    throw error;
  }
}

export async function createCommunityComment(postId, content) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to comment.');
  }

  const payload = {
    post_id: postId,
    user_id: userData.user.id,
    content: content.trim(),
  };

  const { data, error } = await supabase
    .from('community_comments')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  // Update like_count on post (comment count)
  await supabase.rpc('increment_community_post_comment_count', { post_id: postId });

  return data;
}

export async function removeCommunityPostReaction(postId) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to remove reactions.');
  }

  console.log('[removeCommunityPostReaction] DELETE path (explicit remove):', {
    postId,
    userId: userData.user.id,
  });

  // Get existing reaction to delete
  const { data: existingLike } = await supabase
    .from('community_post_likes')
    .select('id, reaction_type')
    .eq('post_id', postId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!existingLike) {
    console.log('[removeCommunityPostReaction] No existing reaction to remove');
    return null;
  }

  console.log('[removeCommunityPostReaction] Deleting existing reaction:', existingLike.reaction_type);

  const { error: deleteError } = await supabase
    .from('community_post_likes')
    .delete()
    .eq('id', existingLike.id);

  if (deleteError) throw deleteError;

  await supabase.rpc('decrement_community_post_like_count', { post_id: postId });
  return null;
}

export async function toggleCommunityPostReaction(postId, reactionType = 'like') {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to react to posts.');
  }

  // Check if already reacted
  const { data: existingLike } = await supabase
    .from('community_post_likes')
    .select('id, reaction_type')
    .eq('post_id', postId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (existingLike) {
    // If same reaction, remove it (toggle off)
    if (existingLike.reaction_type === reactionType) {
      console.log('[toggleCommunityPostReaction] DELETE path (toggle off):', {
        postId,
        userId: userData.user.id,
        reactionType,
        existingLikeId: existingLike.id,
      });
      
      const { error: deleteError } = await supabase
        .from('community_post_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) throw deleteError;

      await supabase.rpc('decrement_community_post_like_count', { post_id: postId });
      return null;
    }

    console.log('[toggleCommunityPostReaction] UPDATE path (switch reaction):', {
      postId,
      userId: userData.user.id,
      from: existingLike.reaction_type,
      to: reactionType,
      existingLikeId: existingLike.id,
    });

    const { error: updateError } = await supabase
      .from('community_post_likes')
      .update({ reaction_type: reactionType })
      .eq('id', existingLike.id);

    if (updateError) throw updateError;

    return reactionType;
  }

  console.log('[toggleCommunityPostReaction] INSERT path (new reaction):', {
    postId,
    userId: userData.user.id,
    reactionType,
  });

  const { error: insertError } = await supabase
      .from('community_post_likes')
      .insert({
        post_id: postId,
        user_id: userData.user.id,
        reaction_type: reactionType,
      });

    if (insertError) throw insertError;

    await supabase.rpc('increment_community_post_like_count', { post_id: postId });
    return reactionType;
  }

export async function submitCommunityReport({ postId, reason, details }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to report this post.');
  }

  const { error } = await supabase
    .from('community_reports')
    .insert({
      post_id: postId,
      reporter_id: userData.user.id,
      reason: reason.trim(),
      details: details?.trim() || null,
    });

  if (error) throw error;
}

export async function deleteCommunityPost(id) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to delete this post.');
  }

  const { error } = await supabase
    .from('community_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);

  if (error) throw error;
}

export async function deleteCommunityComment(id) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to delete this comment.');
  }

  const { data: comment, error: fetchError } = await supabase
    .from('community_comments')
    .select('post_id')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('community_comments')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id);

  if (error) throw error;

  // Decrement comment count
  await supabase.rpc('decrement_community_post_comment_count', { post_id: comment.post_id });

  return comment.post_id;
}
