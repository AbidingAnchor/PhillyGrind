import { sendJson, supabaseAdmin } from './_utils.js';
import { getActiveAlertsForNeighborhood } from './_weatherAlerts.js';
import { sendEmail } from './_utils/email.js';
import { createWeatherAlertEmail } from './_utils/emailTemplate.js';

const NEW_ALERT_WINDOW_MS = 2 * 60 * 60 * 1000;
const PROFILE_PAGE_SIZE = 1000;
const INSERT_CHUNK = 80;

function usableNeighborhood(value) {
  const name = String(value ?? '').trim();
  if (!name || name === 'Any') return '';
  return name;
}

function homeNeighborhood(profile) {
  const home = usableNeighborhood(profile?.neighborhood);
  if (home) return home;
  const served = Array.isArray(profile?.neighborhoods) ? profile.neighborhoods : [];
  for (const value of served) {
    const name = usableNeighborhood(value);
    if (name) return name;
  }
  return '';
}

function isFreshAlert(alert) {
  if (!alert?.issuedAt) return true;
  const issued = new Date(alert.issuedAt).getTime();
  if (Number.isNaN(issued)) return true;
  return Date.now() - issued <= NEW_ALERT_WINDOW_MS;
}

function chunk(list, size) {
  const groups = [];
  for (let index = 0; index < list.length; index += size) {
    groups.push(list.slice(index, index + size));
  }
  return groups;
}

async function loadNotifiableUsers() {
  const users = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, neighborhood, neighborhoods, notifications_enabled, email, weather_alert_email_notifications')
      .or('notifications_enabled.eq.true,notifications_enabled.is.null')
      .range(from, from + PROFILE_PAGE_SIZE - 1);

    if (error) throw error;
    const page = data || [];
    users.push(...page);
    if (page.length < PROFILE_PAGE_SIZE) break;
    from += PROFILE_PAGE_SIZE;
  }

  return users
    .map((profile) => ({
      id: profile.id,
      neighborhood: homeNeighborhood(profile),
      email: profile.email,
      weatherAlertEmailEnabled: profile.weather_alert_email_notifications !== false,
    }))
    .filter((user) => user.id && user.neighborhood);
}

async function existingReceiptKeys(pairs) {
  const keys = new Set();
  if (!pairs.length) return keys;

  const userIds = [...new Set(pairs.map((pair) => pair.userId))];
  const alertIds = [...new Set(pairs.map((pair) => pair.alertId))];

  for (const userChunk of chunk(userIds, 200)) {
    const { data, error } = await supabaseAdmin
      .from('alert_notification_receipts')
      .select('user_id, alert_id, email_sent')
      .in('user_id', userChunk)
      .in('alert_id', alertIds);

    if (error) throw error;
    for (const row of data || []) {
      keys.add(`${row.user_id}::${row.alert_id}::${row.email_sent ? 'emailed' : 'not-emailed'}`);
    }
  }

  return keys;
}

function getSiteUrl() {
  const raw = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://www.phillygrind.work';
  return String(raw).replace(/\/+$/, '');
}

export async function handleDispatchWeatherAlertNotifications(req, res) {
  try {
    const { count: receiptCount, error: countError } = await supabaseAdmin
      .from('alert_notification_receipts')
      .select('user_id', { count: 'exact', head: true });

    if (countError) throw countError;
    const seedOnly = !receiptCount;

    const users = await loadNotifiableUsers();
    const byNeighborhood = new Map();
    for (const user of users) {
      const list = byNeighborhood.get(user.neighborhood) || [];
      list.push(user);
      byNeighborhood.set(user.neighborhood, list);
    }

    const pending = [];
    for (const [neighborhood, neighborhoodUsers] of byNeighborhood) {
      const alerts = await getActiveAlertsForNeighborhood(neighborhood);
      for (const user of neighborhoodUsers) {
        for (const alert of alerts) {
          pending.push({
            userId: user.id,
            alertId: alert.id,
            neighborhood,
            title: alert.title || alert.event || 'Weather alert',
            issuedAt: alert.issuedAt,
            description: alert.description || alert.summary || '',
            expires: alert.until || alert.expires || '',
            email: user.email,
            weatherAlertEmailEnabled: user.weatherAlertEmailEnabled,
          });
        }
      }
    }

    const alreadySent = await existingReceiptKeys(pending);
    const fresh = pending.filter((item) => !alreadySent.has(`${item.userId}::${item.alertId}::not-emailed`));
    const toNotify = seedOnly ? [] : fresh.filter((item) => isFreshAlert(item));
    const receipts = fresh.map((item) => ({
      user_id: item.userId,
      alert_id: item.alertId,
      neighborhood: item.neighborhood,
      email_sent: false,
    }));
    const notifications = toNotify.map((item) => ({
      user_id: item.userId,
      type: 'neighborhood_alert',
      message: `${item.title} in ${item.neighborhood}`,
      alert_id: item.alertId,
      read: false,
    }));

    // Send in-app notifications
    for (const group of chunk(notifications, INSERT_CHUNK)) {
      if (!group.length) continue;
      const { error } = await supabaseAdmin.from('notifications').insert(group);
      if (error) throw error;
    }

    // Write receipts
    for (const group of chunk(receipts, INSERT_CHUNK)) {
      if (!group.length) continue;
      const { error } = await supabaseAdmin
        .from('alert_notification_receipts')
        .upsert(group, { onConflict: 'user_id,alert_id', ignoreDuplicates: true });
      if (error) throw error;
    }

    // Send email notifications for fresh alerts with email enabled
    const siteUrl = getSiteUrl();
    let emailsSent = 0;
    for (const item of toNotify) {
      if (!item.weatherAlertEmailEnabled || !item.email) continue;

      const { subject, html } = createWeatherAlertEmail({
        alertType: item.title,
        neighborhood: item.neighborhood,
        description: item.description,
        expires: item.expires,
        alertUrl: `${siteUrl}/alerts?id=${encodeURIComponent(item.alertId)}`,
        settingsUrl: `${siteUrl}/settings`,
        userId: item.userId,
      });

      try {
        await sendEmail({
          to: item.email,
          subject,
          html,
        });
        emailsSent++;

        // Update receipt to mark email as sent
        await supabaseAdmin
          .from('alert_notification_receipts')
          .update({ email_sent: true })
          .eq('user_id', item.userId)
          .eq('alert_id', item.alertId);
      } catch (emailError) {
        console.warn('[weather-alert-email]', `Failed to send email to ${item.email}:`, emailError.message);
      }
    }

    sendJson(res, 200, {
      ok: true,
      seedOnly,
      neighborhoods: byNeighborhood.size,
      users: users.length,
      livePairs: pending.length,
      receiptsWritten: receipts.length,
      notified: notifications.length,
      emailsSent,
    });
  } catch (error) {
    console.warn('[weather-alert-notifications]', error.message);
    sendJson(res, 500, { error: error.message || 'Could not dispatch weather alert notifications.' });
  }
}
