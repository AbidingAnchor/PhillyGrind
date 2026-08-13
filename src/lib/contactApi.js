import { supabase } from './supabase.js';

export async function sendContactSubmission({ name, email, category, message }) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .insert({
      name: name.trim(),
      email: email.trim(),
      category,
      message: message.trim(),
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  
  // Send email notification
  await sendContactNotification(data);
  
  return data;
}

async function sendContactNotification(submission) {
  try {
    console.log('[Contact API] Sending email notification for submission:', submission.id);
    const response = await fetch('/api/send-contact-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(submission),
    });
    
    const payload = await response.json();
    console.log('[Contact API] Email notification response:', { status: response.status, payload });

    if (!response.ok) {
      console.error('[Contact API] Failed to send contact email notification:', payload);
    } else {
      console.log('[Contact API] Email notification sent successfully');
    }
  } catch (error) {
    console.error('[Contact API] Error sending contact email notification:', error);
  }
}

export async function getContactSubmissions({ category = 'all', status = 'all' } = {}) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  
  let filtered = data ?? [];
  if (category !== 'all') filtered = filtered.filter(s => s.category === category);
  if (status !== 'all') filtered = filtered.filter(s => s.status === status);
  
  return { submissions: filtered };
}

export async function updateContactSubmissionStatus(id, status) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getNewContactCount() {
  const { count, error } = await supabase
    .from('contact_submissions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'new');

  if (error) throw new Error(error.message);
  return count ?? 0;
}
