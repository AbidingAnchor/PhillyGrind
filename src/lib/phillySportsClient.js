const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports';
const IDLE_CACHE_MS = 60_000;
const LIVE_CACHE_MS = 15_000;

export const PHILLY_TEAMS = [
  { id: 'eagles', label: 'Eagles', sport: 'football', league: 'nfl', abbrev: 'phi', espnTeamId: '21' },
  { id: 'sixers', label: 'Sixers', sport: 'basketball', league: 'nba', abbrev: 'phi', espnTeamId: '20' },
  { id: 'phillies', label: 'Phillies', sport: 'baseball', league: 'mlb', abbrev: 'phi', espnTeamId: '22' },
];

const STAT_CATEGORIES = {
  nfl: ['passingYards', 'rushingYards'],
  nba: ['points', 'rebounds', 'assists'],
  mlb: [],
};

let sportsCache = { at: 0, live: false, promise: null };

const DEV_EAGLES_FINAL = {
  id: 'eagles',
  label: 'Eagles',
  league: 'nfl',
  state: 'post',
  startAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  home: true,
  opponent: 'Bengals',
  ourScore: '13',
  oppScore: '30',
  period: 'Final',
  clock: '',
  statusText: 'Final',
  situation: '',
  plays: [
    { id: 'ep1', text: 'END GAME', scoring: false, period: 'Q4', clock: '0:00', team: '' },
    { id: 'ep2', text: 'S. Clifford up the middle to PHI 46 for 3 yards.', scoring: false, period: 'Q4', clock: '0:28', team: 'Eagles' },
    { id: 'ep3', text: 'J. Haynes right guard to PHI 49 for 3 yards.', scoring: false, period: 'Q4', clock: '1:13', team: 'Eagles' },
    { id: 'ep4', text: 'K. Bullock 12 Yd Rush', scoring: true, period: 'Q4', clock: '3:41', team: 'Bengals' },
  ],
  scoringPlays: [
    { id: 'es1', text: 'K. Bullock 12 Yd Rush', scoring: true, period: 'Q4', clock: '3:41', team: 'Bengals' },
    { id: 'es2', text: 'C. Steele 8 Yd pass from A. Dalton', scoring: true, period: 'Q3', clock: '8:12', team: 'Bengals' },
    { id: 'es3', text: 'E. McPherson 29 Yd Field Goal', scoring: true, period: 'Q1', clock: '7:27', team: 'Bengals' },
  ],
  stats: [
    { category: 'Passing', player: 'J. Johnson', value: '12/19, 156 YDS', team: 'Eagles' },
    { category: 'Rushing', player: 'K. Bullock', value: '14 CAR, 85 YDS, 1 TD', team: 'Bengals' },
    { category: 'Receiving', player: 'D. Meyers', value: '3 REC, 51 YDS', team: 'Eagles' },
  ],
  nextGame: {
    opponent: 'Commanders',
    home: true,
    startAt: '2026-09-13T20:25:00.000Z',
  },
};

const DEV_SIXERS_UPCOMING = {
  id: 'sixers',
  label: 'Sixers',
  league: 'nba',
  state: 'pre',
  startAt: '2026-10-05T23:00:00.000Z',
  home: true,
  opponent: 'Knicks',
  ourScore: null,
  oppScore: null,
  period: '',
  clock: '',
  statusText: 'Scheduled',
  situation: '',
  plays: [],
  scoringPlays: [],
  stats: [],
};

const DEV_PHILLIES_LIVE = {
  id: 'phillies',
  label: 'Phillies',
  league: 'mlb',
  state: 'in',
  startAt: new Date().toISOString(),
  home: false,
  opponent: 'Angels',
  ourScore: '4',
  oppScore: '3',
  period: 'Bot 6',
  clock: '',
  statusText: 'Bot 6th',
  situation: '1-2, 2 outs',
  plays: [
    { id: 'p1', text: 'Schwarber lined out to right.', scoring: false, period: 'Bot 6', clock: '', team: 'Phillies' },
    { id: 'p2', text: 'Turner singled to center, Harper to third.', scoring: false, period: 'Bot 6', clock: '', team: 'Phillies' },
    { id: 'p3', text: 'Harper doubled to left, Realmuto scored.', scoring: true, period: 'Bot 6', clock: '', team: 'Phillies' },
    { id: 'p4', text: 'Realmuto walked.', scoring: false, period: 'Bot 6', clock: '', team: 'Phillies' },
    { id: 'p5', text: 'Ward flied out to left.', scoring: false, period: 'Top 6', clock: '', team: 'Angels' },
    { id: 'p6', text: 'Ohtani struck out swinging.', scoring: false, period: 'Top 6', clock: '', team: 'Angels' },
  ],
  scoringPlays: [
    { id: 's1', text: 'Harper doubled to left, Realmuto scored.', scoring: true, period: 'Bot 6', clock: '', team: 'Phillies' },
    { id: 's2', text: 'Bohm singled to right, Turner scored.', scoring: true, period: 'Top 5', clock: '', team: 'Phillies' },
    { id: 's3', text: 'Trout homered to left.', scoring: true, period: 'Bot 4', clock: '', team: 'Angels' },
    { id: 's4', text: 'Schwarber homered to right, Castellanos scored.', scoring: true, period: 'Top 3', clock: '', team: 'Phillies' },
  ],
  stats: [
    { category: 'Hitting', player: 'K. Schwarber', value: '2-4, 2 RBI, 1 HR', team: 'Phillies' },
    { category: 'Hitting', player: 'B. Harper', value: '2-3, 1 RBI', team: 'Phillies' },
    { category: 'Pitching', player: 'Z. Wheeler', value: '6.0 IP, 8 K, 2 ER', team: 'Phillies' },
  ],
};

function withDevLivePreview(payload) {
  if (!import.meta.env.DEV) return payload;
  return {
    anyLive: true,
    teams: [DEV_EAGLES_FINAL, DEV_SIXERS_UPCOMING, DEV_PHILLIES_LIVE],
  };
}

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function teamUrl(team) {
  return `${ESPN_SITE}/${team.sport}/${team.league}/teams/${team.abbrev}`;
}

function scheduleUrl(team, seasonType) {
  return `${ESPN_SITE}/${team.sport}/${team.league}/teams/${team.abbrev}/schedule?seasontype=${seasonType}`;
}

function summaryUrl(team, eventId) {
  return `${ESPN_SITE}/${team.sport}/${team.league}/summary?event=${eventId}`;
}

function scoreboardUrl(team, yyyymmdd) {
  return `${ESPN_SITE}/${team.sport}/${team.league}/scoreboard?dates=${yyyymmdd}`;
}

function eventState(event) {
  return event?.competitions?.[0]?.status?.type?.state || '';
}

function eventDate(event) {
  return event?.competitions?.[0]?.date || event?.date || '';
}

function pickUpcoming(events, afterEvent) {
  const afterId = afterEvent?.id ? String(afterEvent.id) : '';
  const afterTime = Date.parse(eventDate(afterEvent)) || 0;
  const now = Date.now() - 15 * 60 * 1000;
  return (events || []).find((event) => {
    if (afterId && String(event.id) === afterId) return false;
    const state = eventState(event);
    if (state === 'post') return false;
    const at = Date.parse(eventDate(event));
    if (afterTime && Number.isFinite(at) && at <= afterTime) return false;
    if (state === 'in' || state === 'pre') return true;
    return Number.isFinite(at) && at > now;
  }) || null;
}

function yyyymmdd(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function eventHasTeam(event, espnTeamId) {
  return (event?.competitions?.[0]?.competitors || []).some(
    (competitor) => String(competitor.team?.id) === String(espnTeamId),
  );
}

async function findOnScoreboard(team, afterEvent, days = 8) {
  const start = new Date();
  const afterId = afterEvent?.id ? String(afterEvent.id) : '';
  for (let offset = 0; offset < days; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    const board = await fetchJson(scoreboardUrl(team, yyyymmdd(date)));
    const match = (board?.events || []).find((event) => {
      if (afterId && String(event.id) === afterId) return false;
      if (!eventHasTeam(event, team.espnTeamId)) return false;
      const state = eventState(event);
      return state === 'pre' || state === 'in';
    });
    if (match) return match;
  }
  return null;
}

async function findUpcomingEvent(team, afterEvent) {
  if (team.league === 'mlb') {
    return findOnScoreboard(team, afterEvent);
  }

  for (const seasonType of [2, 3, 1]) {
    const schedule = await fetchJson(scheduleUrl(team, seasonType));
    const upcoming = pickUpcoming(schedule?.events, afterEvent);
    if (upcoming) return upcoming;
  }

  return null;
}

async function resolveGames(team, teamPayload) {
  const hinted = teamPayload?.team?.nextEvent?.[0] || null;
  const hintedState = eventState(hinted);

  if (hintedState === 'in' || hintedState === 'pre') {
    return { current: hinted, upcoming: null };
  }

  const upcoming = await findUpcomingEvent(team, hinted);
  if (recentlyCompleted(hinted)) {
    return { current: hinted, upcoming };
  }

  return { current: upcoming || hinted, upcoming: null };
}

function competitorScore(competitor) {
  const score = competitor?.score;
  if (score == null || score === '') return null;
  if (typeof score === 'object') {
    const value = score.displayValue ?? score.value;
    return value == null || value === '' ? null : String(value);
  }
  return String(score);
}

function competitorName(competitor) {
  const team = competitor?.team || {};
  return team.shortDisplayName || team.name || team.displayName || team.abbreviation || 'Opponent';
}

function competitionOf(event, summary) {
  return summary?.header?.competitions?.[0] || event?.competitions?.[0] || null;
}

function periodLabel(team, status) {
  if (!status) return '';
  const detail = status.type?.shortDetail || status.type?.detail || '';
  if (status.type?.completed || status.type?.state === 'post') return 'Final';
  const period = status.period;
  if (team.league === 'mlb') {
    const half = status.periodPrefix || status.type?.altDetail || '';
    if (half && period) return `${half} ${period}`;
    return detail || (period ? `Inning ${period}` : '');
  }
  if (period > 4) return period === 5 ? 'OT' : `OT${period - 4}`;
  if (period) return `Q${period}`;
  return detail;
}

function gameClock(team, status) {
  if (!status || status.type?.state !== 'in') return '';
  if (team.league === 'mlb') return '';
  const clock = status.displayClock;
  if (!clock || clock === '0:00' || clock === '0.0') return '';
  return clock;
}

function playPeriod(team, play) {
  const period = play?.period;
  if (!period) return '';
  if (typeof period === 'object') {
    if (team.league === 'mlb') {
      const half = period.type || period.displayValue || '';
      return period.number ? `${half} ${period.number}`.trim() : half;
    }
    return period.number ? `Q${period.number}` : '';
  }
  return team.league === 'mlb' ? `Inning ${period}` : `Q${period}`;
}

function playClock(play) {
  const clock = play?.clock;
  if (!clock) return '';
  return typeof clock === 'object' ? (clock.displayValue || '') : String(clock);
}

function normalizePlay(team, play) {
  if (!play?.text) return null;
  return {
    id: play.id || `${play.text}-${play.sequenceNumber || ''}`,
    text: play.text.trim(),
    scoring: Boolean(play.scoringPlay),
    period: playPeriod(team, play),
    clock: playClock(play),
    team: play.team?.shortDisplayName || play.team?.abbreviation || play.team?.name || '',
  };
}

function collectPlays(team, summary) {
  if (team.league === 'nfl') {
    const drives = [];
    if (summary.drives?.current) drives.push(summary.drives.current);
    for (const drive of summary.drives?.previous || []) drives.push(drive);
    const plays = drives.flatMap((drive) => drive.plays || []);
    return plays.map((play) => normalizePlay(team, play)).filter(Boolean).slice(-6).reverse();
  }

  const plays = summary.plays || [];
  const meaningful = plays.filter((play) => {
    if (!play.text) return false;
    if (play.scoringPlay) return true;
    const kind = play.type?.type || play.type?.text || play.summaryType || '';
    return /play-result|play result|scoring/i.test(kind);
  });
  const source = meaningful.length ? meaningful : plays.filter((play) => play.text);
  return source.map((play) => normalizePlay(team, play)).filter(Boolean).slice(-6).reverse();
}

function collectScoringPlays(team, summary) {
  const listed = Array.isArray(summary.scoringPlays) ? summary.scoringPlays : [];
  const source = listed.length
    ? listed
    : (summary.plays || []).filter((play) => play.scoringPlay);
  return source.map((play) => normalizePlay(team, play)).filter(Boolean).slice(-4).reverse();
}

function extractLeaders(summary, names) {
  const out = [];
  for (const group of summary.leaders || []) {
    const teamName = group.team?.shortDisplayName || group.team?.name || '';
    for (const category of group.leaders || []) {
      if (names.length && !names.includes(category.name)) continue;
      const top = category.leaders?.[0];
      if (!top) continue;
      out.push({
        category: category.displayName || category.name,
        player: top.athlete?.shortName || top.athlete?.displayName || 'Player',
        value: top.displayValue || '',
        team: teamName,
      });
    }
  }
  return out;
}

function statIndex(statGroup, label) {
  const labels = statGroup.labels || [];
  const keys = statGroup.keys || [];
  const fromLabel = labels.findIndex((item) => item === label);
  if (fromLabel >= 0) return fromLabel;
  return keys.findIndex((item) => item === label);
}

function athleteStat(athlete, statGroup, label) {
  const index = statIndex(statGroup, label);
  if (index < 0) return '';
  return athlete.stats?.[index] ?? '';
}

function extractMlbStats(summary, espnTeamId) {
  const groups = summary.boxscore?.players || [];
  const ours = groups.find((group) => String(group.team?.id) === String(espnTeamId)) || groups[0];
  if (!ours) return [];

  const hitting = (ours.statistics || []).find((stat) => (stat.labels || []).includes('RBI'));
  const pitching = (ours.statistics || []).find((stat) => (stat.labels || []).includes('IP'));
  const out = [];

  if (hitting) {
    const hitters = [...(hitting.athletes || [])]
      .map((row) => ({
        player: row.athlete?.shortName || row.athlete?.displayName || 'Player',
        hits: athleteStat(row, hitting, 'H'),
        ab: athleteStat(row, hitting, 'AB'),
        rbi: athleteStat(row, hitting, 'RBI'),
        hr: athleteStat(row, hitting, 'HR'),
        runs: athleteStat(row, hitting, 'R'),
      }))
      .sort((a, b) => Number(b.rbi || 0) - Number(a.rbi || 0) || Number(b.hits || 0) - Number(a.hits || 0))
      .slice(0, 2);

    for (const hitter of hitters) {
      const bits = [`${hitter.hits || '0'}-${hitter.ab || '0'}`];
      if (Number(hitter.rbi) > 0) bits.push(`${hitter.rbi} RBI`);
      if (Number(hitter.hr) > 0) bits.push(`${hitter.hr} HR`);
      out.push({
        category: 'Hitting',
        player: hitter.player,
        value: bits.join(', '),
        team: ours.team?.shortDisplayName || ours.team?.name || '',
      });
    }
  }

  if (pitching) {
    const pitcher = (pitching.athletes || [])[0];
    if (pitcher) {
      const ip = athleteStat(pitcher, pitching, 'IP');
      const strikeouts = athleteStat(pitcher, pitching, 'K');
      const er = athleteStat(pitcher, pitching, 'ER');
      out.push({
        category: 'Pitching',
        player: pitcher.athlete?.shortName || pitcher.athlete?.displayName || 'Pitcher',
        value: [ip && `${ip} IP`, strikeouts && `${strikeouts} K`, er !== '' && `${er} ER`].filter(Boolean).join(', '),
        team: ours.team?.shortDisplayName || ours.team?.name || '',
      });
    }
  }

  return out.slice(0, 3);
}

function extractNbaBoxStats(summary, espnTeamId) {
  const groups = summary.boxscore?.players || [];
  const ours = groups.find((group) => String(group.team?.id) === String(espnTeamId)) || groups[0];
  const pointsGroup = (ours?.statistics || []).find((stat) => {
    const labels = (stat.labels || []).join(' ');
    const name = stat.name || '';
    return /PTS|points/i.test(labels) || /point/i.test(name);
  });
  if (!pointsGroup) return [];

  const ptsIndex = statIndex(pointsGroup, 'PTS') >= 0 ? statIndex(pointsGroup, 'PTS') : statIndex(pointsGroup, 'points');
  const rebIndex = statIndex(pointsGroup, 'REB') >= 0 ? statIndex(pointsGroup, 'REB') : statIndex(pointsGroup, 'rebounds');
  const astIndex = statIndex(pointsGroup, 'AST') >= 0 ? statIndex(pointsGroup, 'AST') : statIndex(pointsGroup, 'assists');

  return [...(pointsGroup.athletes || [])]
    .map((row) => ({
      player: row.athlete?.shortName || row.athlete?.displayName || 'Player',
      pts: ptsIndex >= 0 ? row.stats?.[ptsIndex] : '',
      reb: rebIndex >= 0 ? row.stats?.[rebIndex] : '',
      ast: astIndex >= 0 ? row.stats?.[astIndex] : '',
    }))
    .sort((a, b) => Number(b.pts || 0) - Number(a.pts || 0))
    .slice(0, 3)
    .map((row) => ({
      category: 'Points',
      player: row.player,
      value: [row.pts && `${row.pts} PTS`, row.reb && `${row.reb} REB`, row.ast && `${row.ast} AST`].filter(Boolean).join(', '),
      team: ours.team?.shortDisplayName || ours.team?.name || '',
    }));
}

function keyStats(team, summary) {
  if (!summary) return [];
  if (team.league === 'mlb') return extractMlbStats(summary, team.espnTeamId);
  const fromLeaders = extractLeaders(summary, STAT_CATEGORIES[team.league] || []);
  if (fromLeaders.length) return fromLeaders.slice(0, 4);
  if (team.league === 'nba') return extractNbaBoxStats(summary, team.espnTeamId);
  return [];
}

function mlbCount(play) {
  const count = play?.pitchCount || play?.resultCount || {};
  const balls = count.balls ?? count.ballCount;
  const strikes = count.strikes ?? count.strikeCount;
  const outs = play?.outs ?? count.outs;
  const parts = [];
  if (balls != null && strikes != null) parts.push(`${balls}-${strikes}`);
  if (outs != null) parts.push(`${outs} out${Number(outs) === 1 ? '' : 's'}`);
  return parts.join(', ');
}

function startingSoon(event) {
  const at = Date.parse(eventDate(event));
  if (!Number.isFinite(at)) return false;
  const diff = at - Date.now();
  return diff <= 10 * 60 * 1000 && diff > -30 * 60 * 1000;
}

function recentlyCompleted(event) {
  if (eventState(event) !== 'post') return false;
  const at = Date.parse(eventDate(event));
  return Number.isFinite(at) && Date.now() - at < 12 * 60 * 60 * 1000;
}

function pickOurCompetitor(team, competitors) {
  return competitors.find((item) => String(item.team?.id) === String(team.espnTeamId))
    || competitors.find((item) => /phil|eagles|76ers|sixers/i.test(competitorName(item)))
    || null;
}

function summarizeUpcoming(team, event) {
  if (!event || eventState(event) !== 'pre') return null;
  const competitors = event.competitions?.[0]?.competitors || [];
  const ours = pickOurCompetitor(team, competitors);
  const opponent = competitors.find((item) => item !== ours) || null;
  const startAt = eventDate(event);
  const name = opponent ? competitorName(opponent) : '';
  if (!name || !startAt) return null;
  return {
    opponent: name,
    home: ours?.homeAway === 'home',
    startAt,
  };
}

function normalizeTeam(team, teamPayload, event, summary, upcomingEvent) {
  const competition = competitionOf(event, summary);
  const status = competition?.status || event?.competitions?.[0]?.status || {};
  const competitors = competition?.competitors || [];
  const ours = pickOurCompetitor(team, competitors);
  const opponent = competitors.find((item) => item !== ours) || null;
  const state = status?.type?.state || eventState(event) || '';
  const startAt = eventDate(event);
  const plays = summary ? collectPlays(team, summary) : [];
  const lastPlay = (summary?.plays || []).filter((play) => play.text).at(-1);

  return {
    id: team.id,
    label: team.label,
    league: team.league,
    state,
    startAt,
    home: ours?.homeAway === 'home',
    opponent: opponent ? competitorName(opponent) : '',
    ourScore: competitorScore(ours),
    oppScore: competitorScore(opponent),
    period: periodLabel(team, status),
    clock: gameClock(team, status),
    statusText: status?.type?.shortDetail || status?.type?.detail || '',
    situation: team.league === 'mlb' && state === 'in' ? mlbCount(lastPlay) : '',
    plays,
    scoringPlays: summary ? collectScoringPlays(team, summary) : [],
    stats: keyStats(team, summary),
    nextGame: state === 'post' ? summarizeUpcoming(team, upcomingEvent) : null,
  };
}

export function formatCountdown(startAt, now = Date.now()) {
  const at = Date.parse(startAt);
  if (!Number.isFinite(at)) return '';
  const diff = at - now;
  if (diff <= 0) return 'Starting soon';
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatKickoff(startAt) {
  const at = Date.parse(startAt);
  if (!Number.isFinite(at)) return '';
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(at);
}

export function loadPhillySports() {
  const now = Date.now();
  const ttl = sportsCache.live ? LIVE_CACHE_MS : IDLE_CACHE_MS;
  if (sportsCache.promise && now - sportsCache.at < ttl) {
    return sportsCache.promise.then(withDevLivePreview);
  }

  const promise = (async () => {
    const teams = await Promise.all(PHILLY_TEAMS.map(async (team) => {
      const payload = await fetchJson(teamUrl(team));
      if (!payload) {
        return { id: team.id, label: team.label, league: team.league, state: '', error: true };
      }
      const { current, upcoming } = await resolveGames(team, payload);
      if (!current) {
        return { id: team.id, label: team.label, league: team.league, state: '', error: true };
      }
      const state = eventState(current);
      const detail = (state === 'in' || startingSoon(current) || recentlyCompleted(current))
        ? await fetchJson(summaryUrl(team, current.id), 10000)
        : null;
      return normalizeTeam(team, payload, current, detail, upcoming);
    }));

    return {
      teams,
      anyLive: teams.some((item) => item.state === 'in'),
    };
  })();

  sportsCache = { at: now, live: sportsCache.live, promise };
  promise.then((payload) => {
    sportsCache.live = Boolean(payload?.anyLive) || (payload?.teams || []).some((item) => {
      if (item.state === 'in') return true;
      const diff = Date.parse(item.startAt) - Date.now();
      return Number.isFinite(diff) && diff < 30 * 60 * 1000 && diff > -3 * 60 * 60 * 1000;
    });
  }).catch(() => {});
  return promise.then(withDevLivePreview);
}
