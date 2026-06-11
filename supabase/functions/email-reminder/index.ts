import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Calculate the timestamp for 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Find users who signed up more than 1 hour ago, haven't confirmed email, and haven't received a reminder
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, name, email, email_reminder_sent_at, created_at')
      .is('email_confirmed_at', null)
      .lt('created_at', oneHourAgo)
      .is('email_reminder_sent_at', null)

    if (usersError) {
      console.error('Error fetching unconfirmed users:', usersError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No users to remind', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send reminder emails to each user
    const results = []
    for (const user of users) {
      try {
        // Generate a new confirmation link
        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'signup',
          email: user.email,
        })

        if (linkError) {
          console.error(`Error generating link for ${user.email}:`, linkError)
          continue
        }

        const confirmationLink = linkData.properties?.action_link

        if (!confirmationLink) {
          console.error(`No confirmation link generated for ${user.email}`)
          continue
        }

        // Send email using Resend (or your email service)
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'PhillyGrind <noreply@phillygrind.com>',
            to: user.email,
            subject: "Don't forget to confirm your PhillyGrind account!",
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirm Your PhillyGrind Account</title>
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #061524 0%, #1a3a2a 100%); padding: 30px; border-radius: 10px; margin-bottom: 20px;">
                  <h1 style="color: white; margin: 0; font-size: 28px;">PhillyGrind</h1>
                </div>
                <p style="font-size: 18px;">Hey ${user.name || 'there'}!</p>
                <p style="font-size: 16px;">You're one step away from joining PhillyGrind — Philadelphia's free job and gig platform.</p>
                <p style="font-size: 16px;">Click below to confirm your email and get started. Your link expires in 24 hours!</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${confirmationLink}" style="display: inline-block; background: #11b874; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">Confirm My Account</a>
                </div>
                <p style="font-size: 14px; color: #666;">If you didn't sign up for PhillyGrind, you can safely ignore this email.</p>
                <p style="font-size: 14px; color: #666;">This link will expire in 24 hours for your security.</p>
              </body>
              </html>
            `,
          }),
        })

        if (!emailResponse.ok) {
          console.error(`Error sending email to ${user.email}:`, await emailResponse.text())
          continue
        }

        // Mark that reminder was sent
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ email_reminder_sent_at: new Date().toISOString() })
          .eq('id', user.id)

        if (updateError) {
          console.error(`Error updating reminder timestamp for ${user.id}:`, updateError)
        }

        results.push({ email: user.email, status: 'sent' })
      } catch (error) {
        console.error(`Error processing user ${user.email}:`, error)
        results.push({ email: user.email, status: 'failed', error: error.message })
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Email reminders processed',
        total: users.length,
        sent: results.filter(r => r.status === 'sent').length,
        failed: results.filter(r => r.status === 'failed').length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in email-reminder function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
