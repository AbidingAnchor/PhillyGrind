import { Link } from 'react-router-dom';
import { ArrowRight, CalendarHeart, PlusCircle } from 'lucide-react';
import HiringEventCard from '../components/HiringEventCard.jsx';
import { hiringEvents } from '../data/hiringEvents.js';

function BrowseHiringEvents() {
  const featuredEvents = hiringEvents.filter((event) => event.featured);
  const otherEvents = hiringEvents.filter((event) => !event.featured);

  return (
    <>
      <section className="browse-hero hiring-events-hero">
        <span className="eyebrow">Hiring Events</span>
        <h1>Philly hiring events & open interviews</h1>
        <p>Meet employers face-to-face at open houses, job fairs, and on-the-spot interview days across the city.</p>
        <Link className="primary-button hiring-events-post-cta" to="/post-hiring-event">
          <PlusCircle size={18} />
          Post a Hiring Event
        </Link>
      </section>

      <section className="page-section hiring-events-page">
        {!hiringEvents.length && (
          <div className="hiring-events-empty">
            <p className="empty-state">No hiring events posted yet. Be the first to post one!</p>
            <Link className="primary-button hiring-events-post-cta" to="/post-hiring-event">
              <PlusCircle size={18} />
              Post a Hiring Event
            </Link>
          </div>
        )}

        {Boolean(featuredEvents.length) && (
          <div className="hiring-events-featured-block">
            <div className="section-heading">
              <span className="icon-chip"><CalendarHeart size={18} /></span>
              <h2>Featured Events</h2>
              <p>Highlighted hiring days from Philly employers hiring now.</p>
            </div>
            <div className="hiring-events-grid featured">
              {featuredEvents.map((event) => (
                <HiringEventCard key={event.id} event={event} featured />
              ))}
            </div>
          </div>
        )}

        {Boolean(otherEvents.length) && (
          <div className="hiring-events-list-block">
            <div className="section-heading">
              <h2>More Events</h2>
              <p>Upcoming hiring events across Philadelphia neighborhoods.</p>
            </div>
            <div className="hiring-events-grid">
              {otherEvents.map((event) => (
                <HiringEventCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        )}

        {Boolean(hiringEvents.length) && (
        <div className="hiring-events-submit-banner">
          <div>
            <h3>Hosting a hiring event?</h3>
            <p>Submit your open house or interview day and we&apos;ll review it within 24 hours.</p>
          </div>
          <Link className="section-link" to="/post-hiring-event">
            Submit your event <ArrowRight size={17} />
          </Link>
        </div>
        )}
      </section>
    </>
  );
}

export default BrowseHiringEvents;
