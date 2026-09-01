# PhillyGrind Scheduled Email Setup

## Overview
Due to Vercel Hobby plan limitations (cron jobs can only run once per day), scheduled email checks have been moved to Supabase Edge Functions that can be called more frequently.

## Services
1. **Weather Alert Checks** - Every 30 minutes for real-time weather warnings
2. **Weekly Digest** - Once per week (recommended: Sunday 9 AM or Monday 9 AM)

## Weather Alert Setup

### 1. Set Environment Variable in Supabase
Add the following environment variable to your Supabase project:
- **Name**: `WEATHER_ALERT_CRON_SECRET`
- **Value**: Generate a secure random string (e.g., `openssl rand -base64 32`)

### 2. Deploy the Edge Function
```bash
# From the project root
supabase functions deploy weather-alert-check
```

### 3. Set Up External Cron Service (Every 30 minutes)

Choose one of these free options:

#### Option A: cron-job.org (Free)
1. Go to https://cron-job.org
2. Create an account
3. Create a new cron job with:
   - **Title**: PhillyGrind Weather Alerts
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/weather-alert-check`
   - **Schedule**: Every 30 minutes (`*/30 * * * *`)
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_WEATHER_ALERT_CRON_SECRET
     Content-Type: application/json
     ```
   - **HTTP Method**: POST

#### Option B: EasyCron (Free tier)
1. Go to https://www.easycron.com
2. Create an account
3. Create a new cron job with:
   - **Cron Expression**: `*/30 * * * *`
   - **URL**: `https://<your-project-ref>.supabase.co/functions/v1/weather-alert-check`
   - **Headers**: 
     ```
     Authorization: Bearer YOUR_WEATHER_ALERT_CRON_SECRET
     ```

#### Option C: GitHub Actions (Free for public repos)
Create `.github/workflows/weather-alert-check.yml`:
```yaml
name: Weather Alert Check
on:
  schedule:
    - cron: '*/30 * * * *'
  workflow_dispatch:

jobs:
  check-weather-alerts:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Edge Function
        run: |
          curl -X POST \
            'https://<your-project-ref>.supabase.co/functions/v1/weather-alert-check' \
            -H 'Authorization: Bearer ${{ secrets.WEATHER_ALERT_CRON_SECRET }}' \
            -H 'Content-Type: application/json'
```

Add `WEATHER_ALERT_CRON_SECRET` to your GitHub repository secrets.

## Weekly Digest Setup

### 1. Set Environment Variable in Supabase
Add the following environment variable to your Supabase project:
- **Name**: `WEEKLY_DIGEST_CRON_SECRET`
- **Value**: Generate a secure random string (e.g., `openssl rand -base64 32`)

### 2. Deploy the Edge Function
```bash
# From the project root
supabase functions deploy weekly-digest
```

### 3. Set Up External Cron Service (Once per week)

Use the same service as weather alerts with different settings:

#### cron-job.org
- **Title**: PhillyGrind Weekly Digest
- **URL**: `https://<your-project-ref>.supabase.co/functions/v1/weekly-digest`
- **Schedule**: Every Sunday at 9 AM (`0 9 * * 0`) or Monday at 9 AM (`0 9 * * 1`)
- **Headers**: 
  ```
  Authorization: Bearer YOUR_WEEKLY_DIGEST_CRON_SECRET
  Content-Type: application/json
  ```
- **HTTP Method**: POST

#### EasyCron
- **Cron Expression**: `0 9 * * 0` (Sunday 9 AM) or `0 9 * * 1` (Monday 9 AM)
- **URL**: `https://<your-project-ref>.supabase.co/functions/v1/weekly-digest`
- **Headers**: 
  ```
  Authorization: Bearer YOUR_WEEKLY_DIGEST_CRON_SECRET
  ```

#### GitHub Actions
Create `.github/workflows/weekly-digest.yml`:
```yaml
name: Weekly Digest
on:
  schedule:
    - cron: '0 9 * * 0'  # Sunday 9 AM
    - cron: '0 9 * * 1'  # Monday 9 AM
  workflow_dispatch:

jobs:
  send-weekly-digest:
    runs-on: ubuntu-latest
    steps:
      - name: Call Supabase Edge Function
        run: |
          curl -X POST \
            'https://<your-project-ref>.supabase.co/functions/v1/weekly-digest' \
            -H 'Authorization: Bearer ${{ secrets.WEEKLY_DIGEST_CRON_SECRET }}' \
            -H 'Content-Type: application/json'
```

Add `WEEKLY_DIGEST_CRON_SECRET` to your GitHub repository secrets.

## Finding Your Supabase Function URLs
Your function URLs will be:
- Weather alerts: `https://<project-ref>.supabase.co/functions/v1/weather-alert-check`
- Weekly digest: `https://<project-ref>.supabase.co/functions/v1/weekly-digest`

Find your project ref in Supabase Dashboard → Settings → API

## Testing the Functions

### Test Weather Alert Function
```bash
curl -X POST \
  'https://<your-project-ref>.supabase.co/functions/v1/weather-alert-check' \
  -H 'Authorization: Bearer YOUR_WEATHER_ALERT_CRON_SECRET' \
  -H 'Content-Type: application/json'
```

Expected response:
```json
{
  "ok": true,
  "neighborhoods": 5,
  "users": 42,
  "livePairs": 3,
  "receiptsWritten": 3,
  "notified": 2,
  "emailsSent": 2
}
```

### Test Weekly Digest Function
```bash
curl -X POST \
  'https://<your-project-ref>.supabase.co/functions/v1/weekly-digest' \
  -H 'Authorization: Bearer YOUR_WEEKLY_DIGEST_CRON_SECRET' \
  -H 'Content-Type: application/json'
```

Expected response:
```json
{
  "ok": true,
  "usersProcessed": 15,
  "emailsSent": 8,
  "emailsSkipped": 7
}
```

## Monitoring
Both Edge Functions log to Supabase's function logs. Monitor at:
Supabase Dashboard → Edge Functions → [function-name] → Logs

## Weekly Digest Features
- ✅ **Opt-in only**: Users must explicitly enable in Settings (default: off)
- ✅ **Neighborhood-scoped**: Only content from user's selected neighborhood
- ✅ **Smart skipping**: No email sent if no new content that week
- ✅ **Concise format**: 3 highlights each (jobs, gigs, community posts)
- ✅ **One-click unsubscribe**: Direct link in email footer
- ✅ **Branded emails**: Matches PhillyGrind email style

## Benefits of This Approach
- ✅ **Real-time alerts**: Weather checks every 30 minutes instead of once daily
- ✅ **No Vercel upgrade needed**: Stays on Hobby plan
- ✅ **Same deduplication**: Weather alerts only notify once per alert
- ✅ **Free external cron**: Multiple free options available
- ✅ **Scalable**: Easy to adjust frequency if needed
- ✅ **User control**: Weekly digest is opt-in only

## Troubleshooting

### Weather Alerts
- **401 Unauthorized**: Check that `WEATHER_ALERT_CRON_SECRET` matches in both Supabase and cron service
- **No alerts triggered**: Check Supabase function logs for errors
- **Missing emails**: Verify `RESEND_API_KEY` is set in Supabase environment variables

### Weekly Digest
- **401 Unauthorized**: Check that `WEEKLY_DIGEST_CRON_SECRET` matches in both Supabase and cron service
- **No emails sent**: Check if users have enabled weekly digest in Settings
- **Empty emails**: Function automatically skips if no new content for neighborhood
- **Missing emails**: Verify `RESEND_API_KEY` is set in Supabase environment variables
