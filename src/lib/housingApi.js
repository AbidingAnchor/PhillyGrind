import { hasSupabaseConfig, supabase } from './supabase.js';
import { isAdminUser } from './adminApi.js';
import { checkFairHousingCompliance } from './moderationService.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const HOUSING_NEIGHBORHOODS = [
  // Philadelphia City
  'Fishtown',
  'Kensington',
  'South Philly',
  'North Philly',
  'West Philly',
  'Northeast Philly',
  'Center City',
  'Germantown',
  'Manayunk',
  'East Falls',
  'Mount Airy',
  'Chestnut Hill',
  'Port Richmond',
  'Frankford',
  'Olney',
  'Brewerytown',
  'Fairmount',
  'Point Breeze',
  'East Passyunk',
  'Queen Village',
  'Old City',
  'University City',
  'Southwest Philly',
  'Overbrook',
  'Wynnefield',
  'Mayfair',
  'Rhawnhurst',
  'Bustleton',
  'Torresdale',
  // Delaware County
  'Delaware County - Chester',
  'Delaware County - Media',
  'Delaware County - Upper Darby',
  'Delaware County - Springfield',
  'Delaware County - Ridley',
  'Delaware County - Havertown',
  // Montgomery County
  'Montgomery County - Norristown',
  'Montgomery County - King of Prussia',
  'Montgomery County - Lansdale',
  'Montgomery County - Abington',
  'Montgomery County - Pottstown',
  // Bucks County
  'Bucks County - Doylestown',
  'Bucks County - Bensalem',
  'Bucks County - Levittown',
  'Bucks County - Newtown',
  // Chester County
  'Chester County - West Chester',
  'Chester County - Coatesville',
  'Chester County - Downingtown',
  // Other
  'Other',
];

function safeDisplayName(value, fallback = 'Landlord') {
  const trimmed = String(value || '').trim();
  if (!trimmed || emailPattern.test(trimmed)) return fallback;
  return trimmed;
}

export function getHousingImagePublicUrl(path) {
  if (!path) return '';
  const trimmed = String(path).trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (!hasSupabaseConfig) return trimmed;

  const { data } = supabase.storage.from('housing-images').getPublicUrl(trimmed);
  return data.publicUrl;
}

function normalizeListing(listing) {
  const profile = listing.profiles || listing.profile || {};
  const landlordName = safeDisplayName(profile.name || listing.landlordName);
  return {
    ...listing,
    type: 'housing',
    landlordName,
    posterName: landlordName,
    landlordVerified: Boolean(profile.identity_verified),
    landlordWarning: Boolean(profile.landlord_warning),
    landlordAvatarUrl: profile.avatar_url || '',
    landlordMemberSince: profile.created_at || listing.created_at,
    images: (listing.images ?? []).map(getHousingImagePublicUrl).filter(Boolean),
  };
}

async function attachLandlordInfo(listings) {
  const list = listings ?? [];
  if (!hasSupabaseConfig || !list.length) return list;

  const userIds = [...new Set(list.map((item) => item.user_id).filter(Boolean))];
  if (!userIds.length) return list.map(normalizeListing);

  const { data, error } = await supabase
    .from('profiles_public')
    .select('id,name,avatar_url,created_at,landlord_verified')
    .in('id', userIds);

  if (error) throw error;

  const profilesById = Object.fromEntries((data ?? []).map((profile) => [profile.id, profile]));
  return list.map((listing) => normalizeListing({
    ...listing,
    profiles: profilesById[listing.user_id],
  }));
}

export async function getHousingListings(filters = {}) {
  if (!hasSupabaseConfig) return [];

  const {
    neighborhood = '',
    bedrooms = 'Any',
    maxRent = 'Any',
    petsAllowed = false,
    user_id = '',
  } = filters;

  let query = supabase
    .from('housing_listings_public')
    .select('*')
    .order('created_at', { ascending: false });

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  if (neighborhood && neighborhood !== 'Any') {
    query = query.eq('neighborhood', neighborhood);
  }

  if (bedrooms && bedrooms !== 'Any') {
    if (bedrooms === '4+') {
      query = query.gte('bedrooms', 4);
    } else {
      query = query.eq('bedrooms', Number(bedrooms));
    }
  }

  if (maxRent && maxRent !== 'Any') {
    if (maxRent === 'under $1000') {
      query = query.lt('monthly_rent', 1000);
    } else if (maxRent === '$1000-$1500') {
      query = query.gte('monthly_rent', 1000).lte('monthly_rent', 1500);
    } else if (maxRent === '$1500-$2000') {
      query = query.gte('monthly_rent', 1500).lte('monthly_rent', 2000);
    } else if (maxRent === '$2000+') {
      query = query.gt('monthly_rent', 2000);
    }
  }

  if (petsAllowed) {
    query = query.eq('pets_allowed', true);
  }

  const { data, error } = await query;
  if (error) throw error;

  return attachLandlordInfo(data ?? []);
}

async function attachAddressIfAllowed(listing) {
  if (!listing?.id) return listing;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return listing;
  if (user.id !== listing.user_id && !isAdminUser(user)) return listing;

  const { data, error } = await supabase
    .from('housing_listings')
    .select('address')
    .eq('id', listing.id)
    .maybeSingle();

  if (error || !data?.address) return listing;
  return { ...listing, address: data.address };
}

export async function getHousingListing(id) {
  if (!hasSupabaseConfig || !uuidPattern.test(id)) return undefined;

  const { data, error } = await supabase
    .from('housing_listings_public')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return undefined;

  const [listing] = await attachLandlordInfo([data]);
  return attachAddressIfAllowed(listing);
}

export async function getLandlordReportCount(listingId) {
  if (!hasSupabaseConfig || !listingId) return 0;

  const { data, error } = await supabase.rpc('landlord_report_count', {
    p_listing_id: listingId,
  });

  if (error) throw error;
  return Number(data) || 0;
}

export async function submitLandlordReport({ listingId, reason, details }) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to report this listing.');
  }

  const { error } = await supabase
    .from('landlord_reports')
    .insert({
      listing_id: listingId,
      reporter_id: userData.user.id,
      reason: reason.trim(),
      details: details.trim(),
    });

  if (error) throw error;
}

export async function uploadHousingImage(file, listingId, index) {
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
  const path = `${userData.user.id}/${listingId}/${index}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from('housing-images')
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) throw uploadError;

  const { data: publicData } = supabase.storage
    .from('housing-images')
    .getPublicUrl(path);

  return publicData.publicUrl;
}

export async function createHousingListing(listing, photoFiles = []) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to post a rental.');
  }

  // Run Fair Housing compliance check
  const moderationResult = await checkFairHousingCompliance(listing.description);
  
  if (moderationResult.violation) {
    const flaggedPhrases = moderationResult.flagged_phrases?.join(', ') || 'certain phrases';
    throw new Error(
      `Your housing listing contains language that may violate Fair Housing law. Flagged: ${flaggedPhrases}. Please revise and resubmit.`
    );
  }

  const payload = {
    user_id: userData.user.id,
    title: listing.title.trim(),
    description: listing.description.trim(),
    monthly_rent: Number(listing.monthly_rent) || 0,
    bedrooms: Number(listing.bedrooms) || 0,
    bathrooms: Number(listing.bathrooms) || 0,
    address: listing.address.trim(),
    neighborhood: listing.neighborhood,
    available_date: listing.available_date,
    pets_allowed: Boolean(listing.pets_allowed),
    utilities_included: Boolean(listing.utilities_included),
    status: 'active',
    images: [],
  };

  const { data, error } = await supabase
    .from('housing_listings')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;

  if (photoFiles.length) {
    const imageUrls = await Promise.all(
      photoFiles.map((file, index) => uploadHousingImage(file, data.id, index)),
    );

    const { data: updated, error: updateError } = await supabase
      .from('housing_listings')
      .update({ images: imageUrls })
      .eq('id', data.id)
      .select('*')
      .single();

    if (updateError) throw updateError;
    const [normalized] = await attachLandlordInfo([updated]);
    return normalized;
  }

  const [normalized] = await attachLandlordInfo([data]);
  return normalized;
}

export async function deleteHousingListing(id) {
  if (!hasSupabaseConfig) {
    throw new Error('Supabase credentials are missing.');
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('Please log in to delete this listing.');
  }

  const { data: deleted, error } = await supabase
    .from('housing_listings')
    .delete()
    .eq('id', id)
    .eq('user_id', userData.user.id)
    .select('id');

  if (error) throw error;
  if (!deleted?.length) {
    throw new Error('Listing was not deleted. Please try again.');
  }
}
