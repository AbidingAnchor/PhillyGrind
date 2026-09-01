import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function usableNeighborhood(value: string | null | undefined): string {
  const name = String(value ?? '').trim()
  if (!name || name === 'Any') return ''
  return name
}

function homeNeighborhood(profile: any): string {
  const home = usableNeighborhood(profile?.neighborhood)
  if (home) return home
  const served = Array.isArray(profile?.neighborhoods) ? profile.neighborhoods : []
  for (const value of served) {
    const name = usableNeighborhood(value)
    if (name) return name
  }
  return ''
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Simple authentication check
  const authHeader = req.headers.get('authorization')
  const cronSecret = Deno.env.get('WEEKLY_DIGEST_CRON_SECRET')
  
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Load users with weekly digest enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, neighborhood, neighborhoods, email, name')
      .eq('weekly_digest_email_notifications', true)

    if (usersError) throw usersError

    const digestUsers = (users || [])
      .map((profile: any) => ({
        id: profile.id,
        neighborhood: homeNeighborhood(profile),
        email: profile.email,
        name: profile.name,
      }))
      .filter((user: any) => user.id && user.neighborhood && user.email)

    let totalSent = 0
    let totalSkipped = 0

    for (const user of digestUsers) {
      try {
        // Get new jobs from past 7 days in user's neighborhood
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id, title, company, created_at')
          .eq('neighborhood', user.neighborhood)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5)

        // Get new gigs from past 7 days in user's neighborhood
        const { data: gigs } = await supabase
          .from('gigs')
          .select('id, title, pay, created_at')
          .eq('neighborhood', user.neighborhood)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5)

        // Get new community posts from past 7 days in user's neighborhood
        const { data: communityPosts } = await supabase
          .from('community_posts')
          .select('id, content, like_count, created_at')
          .eq('neighborhood', user.neighborhood)
          .gte('created_at', sevenDaysAgo)
          .order('created_at', { ascending: false })
          .limit(5)

        const totalItems = (jobs?.length || 0) + (gigs?.length || 0) + (communityPosts?.length || 0)

        // Skip if nothing new
        if (totalItems === 0) {
          totalSkipped++
          console.log(`Skipping digest for ${user.email} - no new content in ${user.neighborhood}`)
          continue
        }

        // Generate email content
        const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || 'https://www.phillygrind.work'
        const subject = `What's new in ${user.neighborhood} this week`

        // Build email HTML
        const jobItems = (jobs || []).slice(0, 3).map((job: any) => `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="${siteUrl}/jobs/${job.id}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${escapeHtml(job.title)}
              </a>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${escapeHtml(job.company || '')}</p>
            </td>
          </tr>
        `).join('')

        const gigItems = (gigs || []).slice(0, 3).map((gig: any) => `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="${siteUrl}/gigs/${gig.id}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${escapeHtml(gig.title)}
              </a>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${escapeHtml(gig.pay || '')}</p>
            </td>
          </tr>
        `).join('')

        const communityItems = (communityPosts || []).slice(0, 3).map((post: any) => `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
              <a href="${siteUrl}/?post=${encodeURIComponent(post.id)}" style="color: #111827; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${escapeHtml(post.content?.slice(0, 60) || 'Community post')}
              </a>
              <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 13px;">${post.like_count || 0} likes</p>
            </td>
          </tr>
        `).join('')

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${subject}</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #061524 0%, #1a3a2a 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
              <h1 style="color: white; margin: 0; font-size: 28px;">PhillyGrind</h1>
            </div>
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">What's new in ${escapeHtml(user.neighborhood)} this week</h2>
            <p style="margin: 0 0 24px 0; color: #374151; font-size: 15px; line-height: 1.6;">
              Here are ${totalItems} new opportunities and conversations from your neighborhood this week.
            </p>

            ${jobs?.length ? `
            <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">New Jobs (${jobs.length})</h3>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${jobItems}
            </table>
            ` : ''}

            ${gigs?.length ? `
            <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">New Gigs (${gigs.length})</h3>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${gigItems}
            </table>
            ` : ''}

            ${communityPosts?.length ? `
            <h3 style="margin: 24px 0 12px 0; font-size: 16px; color: #111827;">Community Posts (${communityPosts.length})</h3>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              ${communityItems}
            </table>
            ` : ''}

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 32px 0;">
              <tr>
                <td align="center" style="padding: 8px 0;">
                  <a href="${siteUrl}/" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    Explore More on PhillyGrind
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin: 24px 0 0 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
              <a href="${siteUrl}/settings?action=unsubscribe-digest" style="color: #22c55e; text-decoration: none;">Unsubscribe from weekly digest</a>
            </p>
          </body>
          </html>
        `

        // Send email via Resend
        const resendApiKey = Deno.env.get('RESEND_API_KEY')
        if (!resendApiKey) {
          console.error('RESEND_API_KEY not set')
          continue
        }

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'PhillyGrind <noreply@phillygrind.work>',
            to: user.email,
            subject,
            html,
          }),
        })

        if (emailResponse.ok) {
          totalSent++
          console.log(`Weekly digest sent to ${user.email} for ${user.neighborhood}`)
        } else {
          console.error(`Failed to send digest to ${user.email}:`, await emailResponse.text())
        }
      } catch (userError) {
        console.error(`Error processing digest for ${user.email}:`, userError)
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        usersProcessed: digestUsers.length,
        emailsSent: totalSent,
        emailsSkipped: totalSkipped,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Weekly digest error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
