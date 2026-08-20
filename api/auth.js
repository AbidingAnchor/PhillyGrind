import { createClient } from '@supabase/supabase-js';
import { sendEmail } from './_utils/email.js';
import { createExistingAccountEmail } from './_utils/emailTemplate.js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, userId, email } = req.body;
  const clientIP = getClientIP(req);

  console.log('[Auth] API request received:', { action, userId: !!userId, email: !!email, ip: clientIP });

  try {
    if (action === 'capture-ip') {
      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      // Update profile with IP
      const { error } = await supabase
        .from('profiles')
        .update({ last_known_ip: clientIP })
        .eq('id', userId);

      if (error) throw error;

      return res.status(200).json({ success: true, ip: clientIP });
    }

    if (action === 'check-ip-ban') {
      // Check if IP is banned
      const { data, error } = await supabase
        .from('banned_ips')
        .select('*')
        .eq('ip_address', clientIP)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Log the attempt
        await supabase.from('admin_action_log').insert({
          admin_id: null,
          target_user_id: null,
          action_type: 'signup_blocked_ip_ban',
          reason: 'Signup attempt from banned IP',
          metadata: { ip_address: clientIP },
        });
        
        return res.status(403).json({ 
          error: 'Unable to create account at this time.' 
        });
      }

      return res.status(200).json({ allowed: true });
    }

    if (action === 'send-existing-account-email') {
      if (!email) {
        return res.status(400).json({ error: 'email is required' });
      }

      console.log('[Auth] Sending existing account notification email to:', email);

      // Send email to existing account holder
      const emailHtml = createExistingAccountEmail();
      await sendEmail({ to: email, subject: 'Account Already Exists', html: emailHtml });

      console.log('[Auth] Existing account notification email sent successfully to:', email);

      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
