import { useEffect, useMemo, useState } from 'react';
import {
  formatCountdown,
  formatKickoff,
  loadPhillySports,
} from '../lib/phillySportsClient.js';

const LIVE_POLL_MS = 20_000;
const IDLE_POLL_MS = 5 * 60_000;

function matchupLine(team) {
  if (!team.opponent) return 'Next game TBD';
  return team.home ? `vs ${team.opponent}` : `at ${team.opponent}`;
}

function isExpandable(team) {
  return team.state === 'in' || team.state === 'post';
}

function compactScore(team) {
  if (team.ourScore == null || team.oppScore == null) return '';
  return `${team.ourScore}–${team.oppScore}`;
}

function compactStatus(team) {
  if (team.state === 'in') {
    return [matchupLine(team), team.period, team.clock, team.situation].filter(Boolean).join(' · ');
  }
  if (team.state === 'post') {
    return [matchupLine(team), 'Final'].filter(Boolean).join(' · ');
  }
  return matchupLine(team);
}

function nextGameLine(team, now) {
  const next = team.nextGame;
  if (team.state !== 'post' || !next?.startAt || !next.opponent) return '';
  const when = formatCountdown(next.startAt, now);
  if (!when) return '';
  const matchup = next.home ? `vs ${next.opponent}` : `at ${next.opponent}`;
  return `Next: ${matchup} · ${when}`;
}

function PlayList({ title, plays }) {
  if (!plays?.length) return null;
  return (
    <div className="feed-sports-section">
      <span className="feed-sports-section-label">{title}</span>
      <ul className="feed-sports-plays">
        {plays.map((play) => (
          <li key={play.id} className={play.scoring ? 'is-scoring' : undefined}>
            <span className="feed-sports-play-meta">
              {[play.team, play.period, play.clock].filter(Boolean).join(' · ')}
            </span>
            <span className="feed-sports-play-text">{play.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamDetails({ team, liveAnnouncements }) {
  return (
    <>
      <div className="feed-sports-scoreboard" aria-live={liveAnnouncements ? 'polite' : 'off'}>
        <div className="feed-sports-score-row">
          <span>{team.label}</span>
          <strong>{team.ourScore ?? '–'}</strong>
        </div>
        <div className="feed-sports-score-row">
          <span>{team.opponent || 'Opponent'}</span>
          <strong>{team.oppScore ?? '–'}</strong>
        </div>
        <div className="feed-sports-period">
          {[team.period, team.clock, team.situation].filter(Boolean).join(' · ') || team.statusText}
        </div>
      </div>
      <PlayList title="Scoring" plays={team.scoringPlays} />
      <PlayList title="Play-by-play" plays={team.plays} />
      {team.stats?.length > 0 && (
        <div className="feed-sports-section">
          <span className="feed-sports-section-label">Key stats</span>
          <ul className="feed-sports-stats">
            {team.stats.map((stat) => (
              <li key={`${stat.player}-${stat.category}`}>
                <span className="feed-sports-stat-player">{stat.player}</span>
                <span className="feed-sports-stat-value">{stat.value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function TeamRow({ team, now, open, onSelect }) {
  if (team.error) {
    return (
      <div className={`feed-sports-team feed-sports-team--${team.id}`}>
        <strong className="feed-sports-team-name">{team.label}</strong>
        <p className="feed-sports-kickoff">Unavailable right now</p>
      </div>
    );
  }

  const live = team.state === 'in';
  const final = team.state === 'post';
  const expandable = isExpandable(team);
  const countdown = !live && !final && team.startAt ? formatCountdown(team.startAt, now) : '';
  const kickoff = !expandable && team.startAt ? formatKickoff(team.startAt) : '';
  const score = compactScore(team);
  const nextLine = nextGameLine(team, now);

  const header = (
    <>
      <span className="feed-sports-team-top">
        <span className="feed-sports-team-chip" aria-hidden="true" />
        <strong className="feed-sports-team-name">{team.label}</strong>
        {live && (
          <span className="feed-sports-live-pill">
            <span className="feed-sports-live-dot" aria-hidden="true" />
            Live
          </span>
        )}
        {final && <span className="feed-sports-final-pill">Final</span>}
        {score && <span className="feed-sports-compact-score">{score}</span>}
        {!expandable && countdown && (
          <span className="feed-sports-countdown">{countdown}</span>
        )}
      </span>
      <span className="feed-sports-matchup">{compactStatus(team)}</span>
      {nextLine ? <span className="feed-sports-next">{nextLine}</span> : null}
    </>
  );

  return (
    <div className={`feed-sports-team feed-sports-team--${team.id}${live ? ' is-live' : ''}${final ? ' is-final' : ''}${open ? ' is-open' : ''}`}>
      {expandable ? (
        <button
          type="button"
          className="feed-sports-team-toggle"
          onClick={() => onSelect(team.id)}
          aria-expanded={open}
          aria-controls={`feed-sports-details-${team.id}`}
        >
          {header}
        </button>
      ) : (
        <div className="feed-sports-team-static">
          {header}
          {kickoff && <p className="feed-sports-kickoff">{kickoff}</p>}
        </div>
      )}

      {expandable && (
        <div
          id={`feed-sports-details-${team.id}`}
          className="feed-sports-details"
          aria-hidden={!open}
        >
          <div className="feed-sports-details-inner">
            <TeamDetails team={team} liveAnnouncements={open && live} />
          </div>
        </div>
      )}
    </div>
  );
}

export default function PhillySportsWidget() {
  const [payload, setPayload] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [openId, setOpenId] = useState('');
  const teams = payload?.teams || [];
  const pollLive = Boolean(payload?.anyLive) || teams.some((team) => {
    if (team.state === 'in') return true;
    const diff = Date.parse(team.startAt) - Date.now();
    return Number.isFinite(diff) && diff < 30 * 60 * 1000 && diff > -3 * 60 * 60 * 1000;
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const next = await loadPhillySports();
        if (cancelled) return;
        setPayload(next);
        setLoaded(true);
      } catch {
        if (!cancelled) {
          setPayload(null);
          setLoaded(true);
        }
      }
    }

    refresh();
    const poll = window.setInterval(() => {
      if (document.hidden) return;
      refresh();
    }, pollLive ? LIVE_POLL_MS : IDLE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [pollLive]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const previewNote = useMemo(
    () => import.meta.env.DEV && teams.some((team) => team.state === 'in' || team.state === 'post'),
    [teams],
  );

  function selectTeam(id) {
    setOpenId((current) => (current === id ? '' : id));
  }

  return (
    <article className="feed-left-card feed-sports-card" aria-label="Philly sports">
      <div className="feed-sports-header">
        <span className="feed-sports-kicker">Philly Sports</span>
      </div>
      <div className="feed-sports-body">
        {!loaded && <p className="feed-sports-empty">Checking the scoreboard…</p>}
        {loaded && !teams.length && (
          <p className="feed-sports-empty">Scores unavailable right now.</p>
        )}
        {teams.map((team) => (
          <TeamRow
            key={team.id}
            team={team}
            now={now}
            open={openId === team.id}
            onSelect={selectTeam}
          />
        ))}
        <p className="feed-sports-source">
          {previewNote ? 'Local live preview — not real scores' : 'Game data from ESPN'}
        </p>
      </div>
    </article>
  );
}
