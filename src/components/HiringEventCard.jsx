import { CalendarDays, MapPin } from 'lucide-react';

function companyInitials(name) {
  return String(name || 'PG')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function HiringEventCard({ event, featured = false, compact = false }) {
  const cardClass = [
    'hiring-event-card',
    featured ? 'hiring-event-card-featured' : '',
    compact ? 'hiring-event-card-compact' : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={cardClass}>
      {featured && <div className="hiring-event-featured-banner">Featured Event</div>}
      <span className="hiring-event-badge">HIRING EVENT</span>

      <div className="hiring-event-card-header">
        <span className="hiring-event-logo" aria-hidden="true">
          {event.logoPreview ? (
            <img src={event.logoPreview} alt="" />
          ) : (
            companyInitials(event.companyName)
          )}
        </span>
        <div>
          <p className="hiring-event-company">{event.companyName}</p>
          <h3>{event.title}</h3>
        </div>
      </div>

      <ul className="hiring-event-meta">
        <li>
          <CalendarDays size={16} />
          <span>{event.dateTime}</span>
        </li>
        <li>
          <MapPin size={16} />
          <span>{event.location}</span>
        </li>
      </ul>

      <div className="hiring-event-positions">
        {event.positions.map((position) => (
          <span className="hiring-event-position-tag" key={position}>{position}</span>
        ))}
      </div>

      {!compact && <p className="hiring-event-description">{event.description}</p>}
    </article>
  );
}

export default HiringEventCard;
