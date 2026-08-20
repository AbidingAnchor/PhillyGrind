-- Migration to reconcile existing suspended_users table with new enforcement code
-- Run this in Supabase SQL Editor

-- Step 1: Add UNIQUE constraint on user_id if it doesn't exist
-- This is required for the onConflict: 'user_id' to work in the upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'suspended_users_user_id_key'
    AND conrelid = 'suspended_users'::regclass
  ) THEN
    ALTER TABLE suspended_users 
    ADD CONSTRAINT suspended_users_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- Step 2: Make action_type nullable (for backward compatibility)
-- The new code uses suspension_type, but action_type may still be required in existing schema
ALTER TABLE suspended_users 
ALTER COLUMN action_type DROP NOT NULL;

-- Step 3: Update CHECK constraint for action_type to accept both old and new values
ALTER TABLE suspended_users 
DROP CONSTRAINT IF EXISTS suspended_users_action_type_check;

ALTER TABLE suspended_users 
ADD CONSTRAINT suspended_users_action_type_check 
CHECK (action_type IN ('suspended', 'banned', 'suspend', 'ban', NULL));

-- Step 4: Make suspended_by nullable (for backward compatibility)
ALTER TABLE suspended_users 
ALTER COLUMN suspended_by DROP NOT NULL;

-- Step 5: Add created_at column if it doesn't exist (for new code compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suspended_users' 
    AND column_name = 'created_at'
  ) THEN
    ALTER TABLE suspended_users 
    ADD COLUMN created_at timestamptz DEFAULT now();
    
    -- If suspended_at exists, copy its values to created_at for existing records
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'suspended_users' 
      AND column_name = 'suspended_at'
    ) THEN
      UPDATE suspended_users 
      SET created_at = suspended_at 
      WHERE created_at IS NULL AND suspended_at IS NOT NULL;
    END IF;
  END IF;
END $$;

-- Step 6: Ensure suspension_type column exists and has proper check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suspended_users' 
    AND column_name = 'suspension_type'
  ) THEN
    ALTER TABLE suspended_users 
    ADD COLUMN suspension_type text;
  END IF;
END $$;

-- Step 7: Add/update CHECK constraint for suspension_type
ALTER TABLE suspended_users 
DROP CONSTRAINT IF EXISTS suspended_users_suspension_type_check;

ALTER TABLE suspended_users 
ADD CONSTRAINT suspended_users_suspension_type_check 
CHECK (suspension_type IN ('suspend', 'ban', NULL));

-- Step 8: Ensure expires_at column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suspended_users' 
    AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE suspended_users 
    ADD COLUMN expires_at timestamptz;
  END IF;
END $$;

-- Step 9: Ensure reason column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'suspended_users' 
    AND column_name = 'reason'
  ) THEN
    ALTER TABLE suspended_users 
    ADD COLUMN reason text;
  END IF;
END $$;

-- Step 10: Create indexes for performance if they don't exist
CREATE INDEX IF NOT EXISTS suspended_users_user_id_idx ON suspended_users(user_id);
CREATE INDEX IF NOT EXISTS suspended_users_expires_at_idx ON suspended_users(expires_at) WHERE expires_at IS NOT NULL;

-- Step 11: Enable RLS if not already enabled
ALTER TABLE suspended_users ENABLE ROW LEVEL SECURITY;

-- Step 12: Drop and recreate policies to ensure they match new schema
DROP POLICY IF EXISTS "Admins can read suspended users" ON suspended_users;
CREATE POLICY "Admins can read suspended users"
  ON suspended_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can insert suspended users" ON suspended_users;
CREATE POLICY "Admins can insert suspended users"
  ON suspended_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update suspended users" ON suspended_users;
CREATE POLICY "Admins can update suspended users"
  ON suspended_users FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'admin')
    )
  );

-- Step 13: Update RLS policies on user-write tables to include suspension checks
-- These policies need to be recreated to include the suspended_users check

-- community_posts
DROP POLICY IF EXISTS "Users can insert own community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can insert own community posts if not suspended" ON community_posts;
CREATE POLICY "Users can insert own community posts if not suspended"
  ON community_posts FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Users can update own community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can update own community posts if not suspended" ON community_posts;
CREATE POLICY "Users can update own community posts if not suspended"
  ON community_posts FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Users can delete own community posts" ON community_posts;
DROP POLICY IF EXISTS "Users can delete own community posts if not suspended" ON community_posts;
CREATE POLICY "Users can delete own community posts if not suspended"
  ON community_posts FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

-- community_comments
DROP POLICY IF EXISTS "Users can insert own community comments" ON community_comments;
DROP POLICY IF EXISTS "Users can insert own community comments if not suspended" ON community_comments;
CREATE POLICY "Users can insert own community comments if not suspended"
  ON community_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Users can update own community comments" ON community_comments;
DROP POLICY IF EXISTS "Users can update own community comments if not suspended" ON community_comments;
CREATE POLICY "Users can update own community comments if not suspended"
  ON community_comments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Users can delete own community comments" ON community_comments;
DROP POLICY IF EXISTS "Users can delete own community comments if not suspended" ON community_comments;
CREATE POLICY "Users can delete own community comments if not suspended"
  ON community_comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = auth.uid()
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

-- messages
DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages if not suspended"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND sender_id <> receiver_id
    AND LENGTH(TRIM(content)) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM messages
      WHERE listing_id = messages.listing_id
        AND sender_id = messages.sender_id
        AND created_at > NOW() - INTERVAL '5 minutes'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks
      WHERE blocker_id = receiver_id
      AND blocked_user_id = sender_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM user_blocks
      WHERE blocker_id = sender_id
      AND blocked_user_id = receiver_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

-- reviews
DROP POLICY IF EXISTS "Users can create reviews" ON reviews;
CREATE POLICY "Users can create reviews if not suspended"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = reviewer_id
    AND reviewer_id <> reviewee_id
    AND rating BETWEEN 1 AND 5
    AND LENGTH(TRIM(comment)) > 0
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

-- gigs
DROP POLICY IF EXISTS "Anyone can post gigs" ON gigs;
CREATE POLICY "Anyone can post gigs if not suspended"
  ON gigs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Owners can update gigs" ON gigs;
CREATE POLICY "Owners can update gigs if not suspended"
  ON gigs FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Owners can delete gigs" ON gigs;
CREATE POLICY "Owners can delete gigs if not suspended"
  ON gigs FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

-- jobs
DROP POLICY IF EXISTS "Anyone can post jobs" ON jobs;
CREATE POLICY "Anyone can post jobs if not suspended"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Owners can update jobs" ON jobs;
CREATE POLICY "Owners can update jobs if not suspended"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

DROP POLICY IF EXISTS "Owners can delete jobs" ON jobs;
CREATE POLICY "Owners can delete jobs if not suspended"
  ON jobs FOR DELETE
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1 FROM suspended_users
      WHERE suspended_users.user_id = (SELECT auth.uid())
      AND (suspended_users.expires_at IS NULL OR suspended_users.expires_at > NOW())
    )
  );

