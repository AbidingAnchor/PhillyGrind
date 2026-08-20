import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function getClientIP(req) {
  // Try to get real IP from various headers
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, first one is the client
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to remote address
  return req.socket?.remoteAddress || 'unknown';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, email, password, name, birthdate, tosAgreedAt } = req.body;
  const clientIP = getClientIP(req);

  try {
    if (action === 'signup') {
      // Check if IP is banned before allowing signup
      const { data: ipBan, error: ipBanError } = await supabase
        .from('banned_ips')
        .select('*')
        .eq('ip_address', clientIP)
        .single();

      if (ipBan && !ipBanError) {
        // Log the attempt
        await supabase.from('admin_action_log').insert({
          admin_id: null, // System action
          target_user_id: null,
          action_type: 'signup_blocked_ip_ban',
          reason: 'Signup attempt from banned IP',
          metadata: { ip_address: clientIP },
        });
        
        return res.status(400).json({ 
          error: 'Unable to create account at this time.' 
        });
      }

      // Client-side age verification
      function calculateAge(birthdateStr) {
        const today = new Date();
        const birthDate = new Date(birthdateStr);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        return age;
      }

      if (birthdate) {
        const age = calculateAge(birthdate);
        if (age < 18) {
          return res.status(400).json({ 
            error: 'PhillyGrind requires users to be 18 or older.' 
          });
        }
      }

      // Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { 
            name, 
            tos_agreed_at: tosAgreedAt,
            birthdate,
            client_ip: clientIP // Pass IP to metadata for trigger
          },
        },
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Update profile with IP after trigger creates it
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ last_known_ip: clientIP })
          .eq('id', data.user.id);
      }

      return res.status(200).json(data);
    }

    if (action === 'login') {
      // Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      // Check if user is suspended/banned
      if (data.user) {
        const { data: suspension, error: suspensionError } = await supabase
          .from('suspended_users')
          .select('*')
          .eq('user_id', data.user.id)
          .single();

        if (suspension && !suspensionError) {
          // Check if suspension has expired
          if (suspension.expires_at && new Date(suspension.expires_at) < new Date()) {
            // Auto-lift expired suspension
            await supabase
              .from('suspended_users')
              .delete()
              .eq('user_id', data.user.id);
          } else {
            // User is suspended/banned
            await supabase.auth.signOut();
            
            const message = suspension.suspension_type === 'ban' 
              ? 'Your account has been banned.' 
              : 'Your account has been suspended.';
            
            return res.status(403).json({ error: message });
          }
        }

        // Update profile with IP
        await supabase
          .from('profiles')
          .update({ last_known_ip: clientIP })
          .eq('id', data.user.id);
      }

      return res.status(200).json(data);
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
