import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const NEIGHBORHOOD_COORDS: Record<string, { lat: number; lon: number }> = {
  'Fishtown': { lat: 39.9709, lon: -75.1347 },
  'Kensington': { lat: 39.9906, lon: -75.1214 },
  'South Philly': { lat: 39.9209, lon: -75.1598 },
  'North Philly': { lat: 39.9926, lon: -75.1513 },
  'West Philly': { lat: 39.96, lon: -75.218 },
  'Northeast Philly': { lat: 40.0681, lon: -75.0107 },
  'Center City': { lat: 39.9526, lon: -75.1652 },
  'Germantown': { lat: 40.0379, lon: -75.1745 },
  'Manayunk': { lat: 40.0279, lon: -75.2245 },
  'Other': { lat: 39.9526, lon: -75.1636 },
  'Delaware County - Chester': { lat: 39.8498, lon: -75.3557 },
  'Delaware County - Media': { lat: 39.9168, lon: -75.3877 },
  'Delaware County - Upper Darby': { lat: 39.9615, lon: -75.2707 },
  'Delaware County - Springfield': { lat: 39.9309, lon: -75.3202 },
  'Delaware County - Ridley': { lat: 39.889, lon: -75.3255 },
  'Delaware County - Havertown': { lat: 39.9809, lon: -75.3107 },
  'Montgomery County - Norristown': { lat: 40.1215, lon: -75.3399 },
  'Montgomery County - King of Prussia': { lat: 40.089, lon: -75.3849 },
  'Montgomery County - Lansdale': { lat: 40.2415, lon: -75.2838 },
  'Montgomery County - Abington': { lat: 40.1204, lon: -75.1174 },
  'Montgomery County - Pottstown': { lat: 40.2454, lon: -75.6496 },
  'Bucks County - Doylestown': { lat: 40.3101, lon: -75.1299 },
  'Bucks County - Bensalem': { lat: 40.1046, lon: -74.9513 },
  'Bucks County - Levittown': { lat: 40.1551, lon: -74.8288 },
  'Bucks County - Newtown': { lat: 40.2293, lon: -74.9368 },
  'Chester County - West Chester': { lat: 39.9607, lon: -75.6055 },
  'Chester County - Coatesville': { lat: 39.9832, lon: -75.8238 },
  'Chester County - Downingtown': { lat: 40.0065, lon: -75.7033 },
}

function coordsForNeighborhood(name: string): { lat: number; lon: number } {
  const key = String(name || '').trim()
  return NEIGHBORHOOD_COORDS[key] || NEIGHBORHOOD_COORDS['Center City']
}

async function getActiveAlertsForNeighborhood(supabase: any, neighborhood: string) {
  const name = String(neighborhood || '').trim() || 'Center City'
  const coords = coordsForNeighborhood(name)
  
  try {
    const response = await fetch(
      `https://api.weather.gov/alerts/active?point=${coords.lat},${coords.lon}`,
      {
        headers: {
          'Accept': 'application/geo+json',
          'User-Agent': 'PhillyGrind/1.0 (https://phillygrind.work; drewnegron95@gmail.com)',
        },
      }
    )
    
    if (!response.ok) {
      console.error(`NWS API error for ${name}:`, response.status)
      return []
    }
    
    const data = await response.json()
    const features = data?.features || []
    
    return features.map((feature: any) => {
      const props = feature?.properties
      if (!props) return null
      
      const until = props.ends || props.expires
      const event = props.event || 'Weather Alert'
      const issuedAt = props.onset || props.effective || props.sent || null
      
      return {
        id: String(props.id || feature.id || `${event}-${issuedAt || until}`),
        event,
        title: until ? `${event} until ${until}` : event,
        description: props.description || '',
        summary: props.description?.replace(/\s+/g, ' ').trim().slice(0, 160) || '',
        issuedAt,
        until,
        neighborhood: name,
      }
    }).filter(Boolean)
  } catch (error) {
    console.error(`Failed to fetch alerts for ${name}:`, error)
    return []
  }
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

const NEW_ALERT_WINDOW_MS = 2 * 60 * 60 * 1000 // 2 hours

function isFreshAlert(alert: any): boolean {
  if (!alert?.issuedAt) return true
  const issued = new Date(alert.issuedAt).getTime()
  if (Number.isNaN(issued)) return true
  return Date.now() - issued <= NEW_ALERT_WINDOW_MS
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Simple authentication check (you can enhance this)
  const authHeader = req.headers.get('authorization')
  const cronSecret = Deno.env.get('WEATHER_ALERT_CRON_SECRET')
  
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

    // Load notifiable users
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, neighborhood, neighborhoods, notifications_enabled, email, weather_alert_email_notifications')
      .or('notifications_enabled.eq.true,notifications_enabled.is.null')

    if (usersError) throw usersError

    const notifiableUsers = (users || [])
      .map((profile: any) => ({
        id: profile.id,
        neighborhood: homeNeighborhood(profile),
        email: profile.email,
        weatherAlertEmailEnabled: profile.weather_alert_email_notifications !== false,
      }))
      .filter((user: any) => user.id && user.neighborhood)

    // Group by neighborhood
    const byNeighborhood = new Map<string, any[]>()
    for (const user of notifiableUsers) {
      const list = byNeighborhood.get(user.neighborhood) || []
      list.push(user)
      byNeighborhood.set(user.neighborhood, list)
    }

    // Check for alerts and collect pending notifications
    const pending: any[] = []
    for (const [neighborhood, neighborhoodUsers] of byNeighborhood) {
      const alerts = await getActiveAlertsForNeighborhood(supabase, neighborhood)
      for (const user of neighborhoodUsers) {
        for (const alert of alerts) {
          pending.push({
            userId: user.id,
            alertId: alert.id,
            neighborhood,
            title: alert.title || alert.event || 'Weather alert',
            issuedAt: alert.issuedAt,
            description: alert.description || alert.summary || '',
            expires: alert.until || '',
            email: user.email,
            weatherAlertEmailEnabled: user.weatherAlertEmailEnabled,
          })
        }
      }
    }

    // Check existing receipts to avoid duplicates
    const userIds = [...new Set(pending.map((p) => p.userId))]
    const alertIds = [...new Set(pending.map((p) => p.alertId))]
    
    const existingReceipts = new Set<string>()
    for (let i = 0; i < userIds.length; i += 200) {
      const userChunk = userIds.slice(i, i + 200)
      const { data: receipts } = await supabase
        .from('alert_notification_receipts')
        .select('user_id, alert_id, email_sent')
        .in('user_id', userChunk)
        .in('alert_id', alertIds)
      
      for (const row of receipts || []) {
        existingReceipts.add(`${row.user_id}::${row.alert_id}::${row.email_sent ? 'emailed' : 'not-emailed'}`)
      }
    }

    const fresh = pending.filter((item) => !existingReceipts.has(`${item.userId}::${item.alertId}::not-emailed`))
    const toNotify = fresh.filter((item) => isFreshAlert(item))

    // Write receipts
    const receipts = fresh.map((item) => ({
      user_id: item.userId,
      alert_id: item.alertId,
      neighborhood: item.neighborhood,
      email_sent: false,
    }))

    for (let i = 0; i < receipts.length; i += 80) {
      const chunk = receipts.slice(i, i + 80)
      if (chunk.length === 0) continue
      const { error } = await supabase
        .from('alert_notification_receipts')
        .upsert(chunk, { onConflict: 'user_id,alert_id', ignoreDuplicates: true })
      if (error) throw error
    }

    // Send in-app notifications
    const notifications = toNotify.map((item) => ({
      user_id: item.userId,
      type: 'neighborhood_alert',
      message: `${item.title} in ${item.neighborhood}`,
      alert_id: item.alertId,
      read: false,
    }))

    for (let i = 0; i < notifications.length; i += 80) {
      const chunk = notifications.slice(i, i + 80)
      if (chunk.length === 0) continue
      const { error } = await supabase.from('notifications').insert(chunk)
      if (error) throw error
    }

    // Send email notifications
    const siteUrl = Deno.env.get('PUBLIC_SITE_URL') || Deno.env.get('SITE_URL') || 'https://www.phillygrind.work'
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    let emailsSent = 0

    if (resendApiKey) {
      for (const item of toNotify) {
        if (!item.weatherAlertEmailEnabled || !item.email) continue

        const subject = `${item.title} in ${item.neighborhood}`
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
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">${item.title} in ${item.neighborhood}</h2>
            ${item.description ? `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${item.description.replace(/\s+/g, ' ').trim()}</p>
            </div>
            ` : ''}
            ${item.expires ? `
            <p style="margin: 0 0 16px 0; color: #374151; font-size: 15px; line-height: 1.6;">
              <strong>Expires:</strong> ${item.expires}
            </p>
            ` : ''}
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 24px 0;">
              <tr>
                <td align="center" style="padding: 8px 0;">
                  <a href="${siteUrl}/alerts?id=${encodeURIComponent(item.alertId)}" style="display: inline-block; background: #22c55e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                    View Alert Details
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin: 0; color: #6b7280; font-size: 13px; line-height: 1.6;">
              You can turn off weather alert emails in
              <a href="${siteUrl}/settings" style="color: #22c55e; text-decoration: none;">Settings</a>.
            </p>
          </body>
          </html>
        `

        try {
          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'PhillyGrind <noreply@phillygrind.work>',
              to: item.email,
              subject,
              html,
            }),
          })

          if (emailResponse.ok) {
            emailsSent++
            // Update receipt to mark email as sent
            await supabase
              .from('alert_notification_receipts')
              .update({ email_sent: true })
              .eq('user_id', item.userId)
              .eq('alert_id', item.alertId)
          } else {
            console.error(`Failed to send email to ${item.email}:`, await emailResponse.text())
          }
        } catch (emailError) {
          console.error(`Error sending email to ${item.email}:`, emailError)
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        neighborhoods: byNeighborhood.size,
        users: notifiableUsers.length,
        livePairs: pending.length,
        receiptsWritten: receipts.length,
        notified: notifications.length,
        emailsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Weather alert check error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
