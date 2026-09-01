# Weather Alert Cron Job Setup

## Overview
Due to Vercel Hobby plan limitations (cron jobs can only run once per day), weather alert checks have been moved to a Supabase Edge Function that can be called more frequently.

## What Changed
- ✅ Created Supabase Edge Function: `supabase/functions/weather-alert-check/index.ts`
- ✅ Removed Vercel cron job for weather alerts (was daily at 11:15 AM)
- ✅ Added authentication via `WEATHER_ALERT_CRON_SECRET` environment variable

## Required Setup

### 1. Set Environment Variable in Supabase
Add the following environment variable to your Supabase project:
- **Name**: `WEATHER_ALERT_CRON_SECRET`
- **Value**: Generate a secure random string (e.g., `openssl rand -base64 32`)

### 2. Deploy the Edge Function
```bash
# From the project root
supabase functions deploy weather-alert-check
```

### 3. Set Up External Cron Service

Choose one of these free options to call the Edge Function every 30 minutes:

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

## Finding Your Supabase Function URL
Your function URL will be:
```
https://<project-ref>.supabase.co/functions/v1/weather-alert-check
```

Find your project ref in Supabase Dashboard → Settings → API

## Testing the Function
Test the function manually before setting up the cron:
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

## Monitoring
The Edge Function logs to Supabase's function logs. Monitor at:
Supabase Dashboard → Edge Functions → weather-alert-check → Logs

## Benefits of This Approach
- ✅ **Real-time alerts**: Checks every 30 minutes instead of once daily
- ✅ **No Vercel upgrade needed**: Stays on Hobby plan
- ✅ **Same deduplication**: Still only notifies once per alert
- ✅ **Free external cron**: Multiple free options available
- ✅ **Scalable**: Easy to adjust frequency if needed

## Troubleshooting
- **401 Unauthorized**: Check that `WEATHER_ALERT_CRON_SECRET` matches in both Supabase and cron service
- **No alerts triggered**: Check Supabase function logs for errors
- **Missing emails**: Verify `RESEND_API_KEY` is set in Supabase environment variables
