import { hasSupabaseConfig, supabase } from './supabase.js';
import { createListingWithModeration } from './adminApi.js';
import { normalizeReactionType } from './reactions.js';
import { checkCommunitySafety } from './moderationService.js';
import { getFilteredUsers } from './moderationApi.js';
import { REACTIONS } from './reactions.js';
import { HOME_NEIGHBORHOODS } from './homeNeighborhood.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const COMMUNITY_NEIGHBORHOODS = HOME_NEIGHBORHOODS;

function usableNeighborhood(value) {
  const name = String(value ?? '').trim();
  if (!name || name === 'Any') return '';
  return name;
}

export function resolveHomeNeighborhood(profile) {
  const home = usableNeighborhood(profile?.neighborhood);
  if (home) return home;

  const served = Array.isArray(profile?.neighborhoods) ? profile.neighborhoods : [];
  for (const value of served) {
    const name = usableNeighborhood(value);
    if (name) return name;
  }

  return '';
}

export async function fetchHomeNeighborhood(userId, profile) {
  const fromProfile = usableNeighborhood(profile?.neighborhood);
  if (fromProfile) return fromProfile;
  if (!hasSupabaseConfig || !userId) return '';

  const { data: publicProfile } = await supabase
    .from('profiles_public')
    .select('neighborhood')
    .eq('id', userId)
    .maybeSingle();

  return usableNeighborhood(publicProfile?.neighborhood);
}

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
  console.log('[attachAuthorInfo] called with', posts?.length || 0, 'posts');
  const list = posts ?? [];
  if (!hasSupabaseConfig || !list.length) return list.map(normalizePost);

  const userIds = [...new Set(list.map((item) => item.user_id).filter(Boolean))];
  console.log('[attachAuthorInfo] userIds to fetch:', userIds);
  console.log('[attachAuthorInfo] Target post 7776d917-3717-4b47-9b52-755984430779 user_id in list:', userIds.includes('22271450-758a-4a46-843b-195eae5b8079'));

  if (!userIds.length) return list.map(normalizePost);

  const { data, error } = await supabase
    .from('profiles_public')
    .select('id,name,avatar_url')
    .in('id', userIds);

  if (error) throw error;

  console.log('[attachAuthorInfo] profiles returned from profiles_public:', data);
  console.log('[attachAuthorInfo] Profile for 22271450-758a-4a46-843b-195eae5b8079 found:', data?.find(p => p.id === '22271450-758a-4a46-843b-195eae5b8079'));

  const profilesById = Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
  console.log('[attachAuthorInfo] profilesById map keys:', Object.keys(profilesById));

  const result = list.map((post) => {
    const profile = profilesById[post.user_id];
    console.log('[attachAuthorInfo] Mapping post', post.id, 'user_id:', post.user_id, 'profile found:', !!profile);
    return normalizePost({
      ...post,
      profiles: profile,
    });
  });

  console.log('[attachAuthorInfo] Target post 7776d917-3717-4b47-9b52-755984430779 in result:', result.find(p => p.id === '7776d917-3717-4b47-9b52-755984430779'));
  return result;
}

export function getCommunityPhotoPublicUrl(path) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!hasSupabaseConfig) return trimmed;

  const { data } = supabase.storage.from('community-photos').getPublicUrl(trimmed);
  return data.publicUrl;
}

function applyGroupScope(query, groupId) {
  if (groupId) {
    return query.eq('group_id', groupId);
  }
  return query.is('group_id', null);
}

export async function getCommunityPosts(filters = {}) {
  if (!hasSupabaseConfig) return [];

  const { neighborhood = 'Any', groupId = null } = filters;

  // Use RPC to get posts with comment counts
  let query = supabase.rpc('get_community_posts_with_counts', {
    p_neighborhood: neighborhood === 'Any' ? null : neighborhood,
    p_group_id: groupId || null,
  });

  const { data, error } = await query;
  if (error) {
    console.error('[getCommunityPosts] RPC error, falling back to basic query:', error);
    // Fallback to basic query if RPC doesn't exist
    let basicQuery = supabase
      .from('community_posts')
      .select('*')
      .or('hidden.eq.false,hidden.is.null')
      .order('created_at', { ascending: false });

    basicQuery = applyGroupScope(basicQuery, groupId);

    if (neighborhood && neighborhood !== 'Any') {
      basicQuery = basicQuery.eq('neighborhood', neighborhood);
    }

    const { data: basicData, error: basicError } = await basicQuery;
    if (basicError) throw basicError;

    const posts = basicData ?? [];
    
    // Filter out posts from blocked/muted users
    const filteredUserIds = await getFilteredUsers();
    const filteredPosts = posts.filter((post) => !filteredUserIds.includes(post.user_id));

    // Manually fetch comment counts for each post (including nested replies)
    const postIds = filteredPosts.map(p => p.id);
    const { data: allComments, error: countError } = postIds.length > 0
      ? await supabase
          .from('community_comments')
          .select('post_id')
          .in('post_id', postIds)
      : { data: [], error: null };

    if (countError) console.error('[getCommunityPosts] Error fetching comment counts:', countError);

    const countsByPost = {};
    if (allComments) {
      allComments.forEach(c => {
        countsByPost[c.post_id] = (countsByPost[c.post_id] || 0) + 1;
      });
    }

    const postsWithCounts = filteredPosts.map(post => ({
      ...post,
      comment_count: countsByPost[post.id] || 0
    }));

    return await attachAuthorInfo(postsWithCounts);
  }

  const posts = data ?? [];
  
  // Filter out posts from blocked/muted users
  const filteredUserIds = await getFilteredUsers();
  const filteredPosts = posts.filter((post) => !filteredUserIds.includes(post.user_id));

  // Fetch original post data for shared posts
  const sharedPostIds = filteredPosts
    .filter(post => post.shared_post_id)
    .map(post => post.shared_post_id);

  let originalPostsMap = {};
  if (sharedPostIds.length > 0) {
    const { data: originalPosts, error: originalError } = await supabase
      .from('community_posts')
      .select('*')
      .in('id', sharedPostIds);

    if (!originalError && originalPosts) {
      originalPosts.forEach(original => {
        originalPostsMap[original.id] = original;
      });
    }
  }

  // Attach original post data to shared posts
  const postsWithOriginalData = filteredPosts.map(post => {
    if (post.shared_post_id && originalPostsMap[post.shared_post_id]) {
      return {
        ...post,
        original_post: originalPostsMap[post.shared_post_id]
      };
    }
    return post;
  });

  // Attach author info to all posts (including original posts in shared posts)
  const postsWithAuthors = await attachAuthorInfo(postsWithOriginalData);
  
  // Also attach author info to original posts
  for (const post of postsWithAuthors) {
    if (post.original_post) {
      const [originalWithAuthor] = await attachAuthorInfo([post.original_post]);
      post.original_post = originalWithAuthor;
    }
  }

  return postsWithAuthors;
}

export async function getGroupPosts(groupId, filters = {}) {
  if (!groupId) return [];
  return getCommunityPosts({ ...filters, groupId });
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

export function canViewActivity(viewerId, profileOwnerId) {
  // TODO: Implement friends/connections visibility logic
  // For now, always return true (public visibility)
  return true;
}

export async function getUserCommunityPosts(userId, page = 1, limit = 10) {
  if (!hasSupabaseConfig || !uuidPattern.test(userId)) return { posts: [], hasMore: false };

  const offset = (page - 1) * limit;

  let query = supabase
    .from('community_posts')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  const posts = await attachAuthorInfo(data ?? []);
  const hasMore = count !== null && offset + limit < count;

  return { posts, hasMore };
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
  
  // Filter out comments from blocked/muted users
  const filteredUserIds = await getFilteredUsers();
  const filteredComments = comments.filter((comment) => !filteredUserIds.includes(comment.user_id));
  
  const userIds = [...new Set(filteredComments.map((comment) => comment.user_id).filter(Boolean))];
  
  console.log('[getCommunityComments] postId:', postId, 'comments:', filteredComments.length, 'userIds:', userIds);
  
  if (!userIds.length) {
    return filteredComments.map((comment) => ({
      ...comment,
      authorName: 'PhillyGrind user',
      authorAvatarUrl: '',
      replies: [],
    }));
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles_public')
    .select('id,name,avatar_url')
    .in('id', userIds);

  if (profileError) throw profileError;

  console.log('[getCommunityComments] profiles fetched:', profiles?.length, 'profiles:', profiles);
  
  const profilesById = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
  
  const commentsWithAuthor = filteredComments.map((comment) => {
    const profile = profilesById[comment.user_id];
    const authorName = safeDisplayName(profile?.name);
    console.log('[getCommunityComments] comment:', comment.id, 'user_id:', comment.user_id, 'profile found:', !!profile, 'profile.name:', profile?.name, 'authorName:', authorName);
    
    return {
      ...comment,
      authorName,
      authorAvatarUrl: profile?.avatar_url || '',
      relativeTime: formatRelativeTime(comment.created_at),
      replies: [],
    };
  });
  
  // Build hierarchical structure
  const commentMap = new Map();
  const topLevelComments = [];
  
  // First pass: create map and identify top-level comments
  commentsWithAuthor.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });
  
  // Second pass: build tree structure
  commentsWithAuthor.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id);
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id);
      if (parent) {
        parent.replies.push(commentWithReplies);
      } else {
        // Parent not found, treat as top-level
        topLevelComments.push(commentWithReplies);
      }
    } else {
      topLevelComments.push(commentWithReplies);
    }
  });
  
  console.log('[getCommunityComments] final result (hierarchical):', topLevelComments);
  return topLevelComments;
}

export async function getCommunityLikeCount(postId) {
  if (!hasSupabaseConfig || !postId) return 0;

  const { count, error } = await supabase
    .from('community_post_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (error) throw error;
  return count ?? 0;
}

export async function getReactionBreakdown(postId) {
  if (!hasSupabaseConfig || !postId) return [];

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
  if (!hasSupabaseConfig || !postId) return null;

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
  if (!hasSupabaseConfig || !postId) return false;

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

  const groupId = post.groupId || post.group_id || null;

  console.log('[createCommunityPost] Starting post creation:', { content: post.content, neighborhood: post.neighborhood, hasPhoto: !!photoFile, groupId });

  try {
    // Run custom community safety check
    const moderationResult = await checkCommunitySafety(post);
    
    if (moderationResult.autoRejected) {
      throw new Error(moderationResult.error);
    }

    // Run content moderation and create post via API
    const { listing: moderatedPost, moderationStatus } = await createListingWithModeration('community', {
      content: post.content,
      neighborhood: post.neighborhood,
      group_id: groupId,
    });

    console.log('[createCommunityPost] Moderation API response:', { moderationStatus, postId: moderatedPost?.id });

    if (!moderatedPost || !moderatedPost.id) {
      throw new Error('Failed to create post: Invalid response from moderation API');
    }

    if (groupId && moderatedPost.group_id !== groupId) {
      const { data: scoped, error: scopeError } = await supabase
        .from('community_posts')
        .update({ group_id: groupId })
        .eq('id', moderatedPost.id)
        .select('*')
        .single();

      if (scopeError) {
        console.error('[createCommunityPost] Failed to set group_id:', scopeError);
        throw scopeError;
      }

      Object.assign(moderatedPost, scoped);
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
        group_id: groupId,
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

export async function createCommunityComment(postId, content, parentCommentId = null) {
  if (!hasSupabaseConfig || !postId) {
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

  if (parentCommentId) {
    payload.parent_comment_id = parentCommentId;
  }

  const { data, error } = await supabase
    .from('community_comments')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  // Update like_count on post (comment count)
  await supabase.rpc('increment_community_post_comment_count', { post_id: postId });

  notifyPostAuthorOfComment(data.id);

  return data;
}

async function notifyPostAuthorOfComment(commentId) {
  if (!commentId) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const response = await fetch('/api/listing-actions?action=comment-on-post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ comment_id: commentId }),
    });

    if (!response.ok) {
      console.warn('[createCommunityComment] comment email notify failed:', response.status);
    }
  } catch (error) {
    console.warn('[createCommunityComment] comment email notify failed:', error);
  }
}

export async function shareCommunityPost(originalPostId, caption = '') {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to share.');
  }

  // First, get the original post to get its neighborhood
  const { data: originalPost, error: fetchError } = await supabase
    .from('community_posts')
    .select('neighborhood')
    .eq('id', originalPostId)
    .single();

  if (fetchError) throw fetchError;
  if (!originalPost) throw new Error('Original post not found');

  // Create the shared post
  const { data, error } = await supabase
    .from('community_posts')
    .insert({
      user_id: userData.user.id,
      content: caption || 'Shared a post',
      neighborhood: originalPost.neighborhood,
      shared_post_id: originalPostId,
    })
    .select('*')
    .single();

  if (error) throw error;

  // Increment the original post's share count
  const { error: updateError } = await supabase
    .from('community_posts')
    .update({ share_count: supabase.raw('share_count + 1') })
    .eq('id', originalPostId);

  if (updateError) console.error('Failed to increment share count:', updateError);

  return data;
}

export async function removeCommunityPostReaction(postId) {
  if (!hasSupabaseConfig || !postId) {
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
  if (!hasSupabaseConfig || !postId) {
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

export async function submitCommunityReport({ postId, commentId, reason, subreason, details }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to report this.');
  }

  const payload = {
    reporter_id: userData.user.id,
    reason: reason.trim(),
    subreason: subreason?.trim() || null,
    details: details?.trim() || null,
  };

  if (postId) {
    payload.post_id = postId;
  }

  if (commentId) {
    payload.comment_id = commentId;
  }

  const { error } = await supabase
    .from('community_reports')
    .insert(payload);

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

export async function getCommentReactionBreakdown(commentId) {
  if (!hasSupabaseConfig || !commentId) return [];

  const { data, error } = await supabase
    .from('community_comment_likes')
    .select('reaction_type')
    .eq('comment_id', commentId);

  if (error) throw error;

  const breakdown = {};
  (data || []).forEach((like) => {
    const type = normalizeReactionType(like.reaction_type) || 'like';
    breakdown[type] = (breakdown[type] || 0) + 1;
  });

  const result = Object.entries(breakdown)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  console.log('[getCommentReactionBreakdown] commentId:', commentId, 'raw rows:', data, 'breakdown:', result);

  return result;
}

export async function getUserCommentReaction(commentId) {
  if (!hasSupabaseConfig || !commentId) return null;

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;

  const { data, error } = await supabase
    .from('community_comment_likes')
    .select('reaction_type')
    .eq('comment_id', commentId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.reaction_type) return null;
  return normalizeReactionType(data.reaction_type);
}

export async function toggleCommentReaction(commentId, reactionType = 'like') {
  if (!hasSupabaseConfig || !commentId) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to react to comments.');
  }

  // Check if already reacted
  const { data: existingLike } = await supabase
    .from('community_comment_likes')
    .select('id, reaction_type')
    .eq('comment_id', commentId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (existingLike) {
    // If same reaction, remove it (toggle off)
    if (existingLike.reaction_type === reactionType) {
      console.log('[toggleCommentReaction] DELETE path (toggle off):', {
        commentId,
        userId: userData.user.id,
        reactionType,
        existingLikeId: existingLike.id,
      });
      
      const { error: deleteError } = await supabase
        .from('community_comment_likes')
        .delete()
        .eq('id', existingLike.id);

      if (deleteError) throw deleteError;

      return null;
    }

    console.log('[toggleCommentReaction] UPDATE path (switch reaction):', {
      commentId,
      userId: userData.user.id,
      from: existingLike.reaction_type,
      to: reactionType,
      existingLikeId: existingLike.id,
    });

    const { error: updateError } = await supabase
      .from('community_comment_likes')
      .update({ reaction_type: reactionType })
      .eq('id', existingLike.id);

    if (updateError) throw updateError;

    return reactionType;
  }

  console.log('[toggleCommentReaction] INSERT path (new reaction):', {
    commentId,
    userId: userData.user.id,
    reactionType,
  });

  const { error: insertError } = await supabase
      .from('community_comment_likes')
      .insert({
        comment_id: commentId,
        user_id: userData.user.id,
        reaction_type: reactionType,
      });

    if (insertError) throw insertError;

    return reactionType;
}

export async function removeCommentReaction(commentId) {
  if (!hasSupabaseConfig || !commentId) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to remove reactions.');
  }

  console.log('[removeCommentReaction] DELETE path (explicit remove):', {
    commentId,
    userId: userData.user.id,
  });

  // Get existing reaction to delete
  const { data: existingLike } = await supabase
    .from('community_comment_likes')
    .select('id, reaction_type')
    .eq('comment_id', commentId)
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (!existingLike) {
    console.log('[removeCommentReaction] No existing reaction to remove');
    return null;
  }

  console.log('[removeCommentReaction] Deleting existing reaction:', existingLike.reaction_type);

  const { error: deleteError } = await supabase
    .from('community_comment_likes')
    .delete()
    .eq('id', existingLike.id);

  if (deleteError) throw deleteError;

  return null;
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

export async function getPostReactorsList(postId) {
  if (!hasSupabaseConfig || !postId) return [];

  const { data, error } = await supabase
    .from('community_post_likes')
    .select('user_id, reaction_type')
    .eq('post_id', postId);

  if (error) throw error;

  const userIds = [...new Set(data.map(r => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles_public')
    .select('id, name, avatar_url')
    .in('id', userIds);

  const profilesById = Object.fromEntries((profiles || []).map(p => [p.id, p]));

  return data.map(r => ({
    userId: r.user_id,
    reactionType: r.reaction_type,
    name: profilesById[r.user_id]?.name || 'Unknown',
    avatarUrl: profilesById[r.user_id]?.avatar_url || null,
  }));
}

export async function searchCommunityPosts(query) {
  if (!hasSupabaseConfig || !query?.trim()) return [];

  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .is('group_id', null)
    .ilike('content', `%${query}%`)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return attachAuthorInfo(data);
}

export async function getTrendingPosts(limit = 5) {
  if (!hasSupabaseConfig) return [];

  const { data: posts, error } = await supabase
    .from('community_posts')
    .select('id, content, created_at, user_id')
    .is('group_id', null)
    .or('hidden.eq.false,hidden.is.null')
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;

  const withCounts = await Promise.all(posts.map(async (post) => {
    const { count } = await supabase
      .from('community_post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', post.id);
    return { ...post, reactionCount: count || 0 };
  }));

  const sorted = withCounts.sort((a, b) => b.reactionCount - a.reactionCount).slice(0, limit);
  return attachAuthorInfo(sorted);
}

export const REACTION_EMOJI = Object.fromEntries(
  REACTIONS.map(r => [r.type, r.emoji])
);
