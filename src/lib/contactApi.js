import { supabase } from './supabase.js';

export async function sendContactSubmission({ name, email, category, message, user_id }) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .insert({
      name: name.trim(),
      email: email.trim(),
      category,
      message: message.trim(),
      user_id,
      status: 'open',
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
    const response = await fetch('/api/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-contact-email', ...submission }),
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
    .in('status', ['open', 'new']);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function sendContactReply(contactId, message) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error('You must be logged in to send replies.');
  }

  // Insert reply
  const { data: reply, error: replyError } = await supabase
    .from('contact_replies')
    .insert({
      contact_id: contactId,
      message: message.trim(),
      sent_by: userData.user.id,
    })
    .select()
    .single();

  if (replyError) throw new Error(replyError.message);

  // Update contact status to 'responded'
  const { error: updateError } = await supabase
    .from('contact_submissions')
    .update({ status: 'responded' })
    .eq('id', contactId);

  if (updateError) throw new Error(updateError.message);

  // Get contact submission details for email
  const { data: contact, error: fetchError } = await supabase
    .from('contact_submissions')
    .select('*')
    .eq('id', contactId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  // Send reply email via Resend
  try {
    await fetch('/api/two-factor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send-contact-reply',
        to: contact.email,
        name: contact.name,
        message: message.trim(),
      }),
    });
  } catch (error) {
    console.error('Failed to send reply email:', error);
    // Don't throw - reply is still saved in database
  }

  return reply;
}

export async function resolveContact(contactId) {
  const { data, error } = await supabase
    .from('contact_submissions')
    .update({ 
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function deleteContact(contactId) {
  const { error } = await supabase
    .from('contact_submissions')
    .delete()
    .eq('id', contactId);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getContactReplies(contactId) {
  const { data, error } = await supabase
    .from('contact_replies')
    .select('*')
    .eq('contact_id', contactId)
    .order('sent_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}
