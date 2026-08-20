# Supabase Auth Hook Setup for Login Blocking

This document describes how to set up the Supabase Auth Hook to block suspended/banned users from logging in at the server level.

## Purpose

The Auth Hook runs server-side in Supabase before a session is issued, ensuring that suspended or banned users cannot bypass client-side checks by calling the Supabase API directly.

## Setup Instructions

1. **Navigate to Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to **Authentication** → **Hooks**

2. **Create a "Before User Signs In" Hook**
   - Click **"Add Hook"**
   - Select **"Before user signs in"** as the hook type
   - Name it: `block_suspended_users`
   - Set it to **Active**

3. **Add the Hook SQL Function**

Copy and paste the following SQL into the hook function:

```sql
-- Check if user is suspended or banned
-- Returns error if active suspension/ban exists

DECLARE
  suspension_record RECORD;
  suspension_message TEXT;
BEGIN
  -- Check for active suspension/ban
  SELECT * INTO suspension_record
  FROM suspended_users
  WHERE user_id = auth.uid()
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  -- If suspension exists, block login
  IF FOUND THEN
    IF suspension_record.suspension_type = 'ban' THEN
      suspension_message := 'Your account has been banned. If you believe this is an error, please contact support.';
    ELSE
      suspension_message := 'Your account has been suspended. If you believe this is an error, please contact support.';
    END IF;

    -- Log the blocked login attempt
    INSERT INTO admin_action_log (admin_id, target_user_id, action_type, reason, metadata)
    VALUES (
      NULL, -- System action
      auth.uid(),
      'login_blocked_suspension',
      suspension_record.reason,
      jsonb_build_object(
        'suspension_type', suspension_record.suspension_type,
        'expires_at', suspension_record.expires_at
      )
    );

    -- Raise error to block login
    RAISE EXCEPTION 'SQLSTATE "45000"';
  END IF;

  -- Allow login to proceed
  RETURN NEW;
END;
```

4. **Save and Enable the Hook**
   - Save the hook
   - Ensure it's set to **Active** status

## Testing

After setting up the hook:

1. **Test with a suspended user:**
   - Suspend a test user via the admin panel
   - Attempt to log in as that user
   - Expected: Login fails with error message

2. **Test with a banned user:**
   - Ban a test user via the admin panel
   - Attempt to log in as that user
   - Expected: Login fails with error message

3. **Test with a normal user:**
   - Log in as a non-suspended user
   - Expected: Login succeeds normally

## Important Notes

- The hook runs **before** a session is issued, so no session is created for suspended/banned users
- The hook is enforced server-side by Supabase, so it cannot be bypassed by direct API calls
- Blocked login attempts are logged to `admin_action_log` for audit purposes
- Expired suspensions (where `expires_at` is in the past) are automatically ignored
