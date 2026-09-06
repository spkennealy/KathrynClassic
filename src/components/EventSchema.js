import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { getCurrentTournamentYear, getTournamentData, getTournamentEvents } from '../utils/tournamentUtils';

const SITE_URL = 'https://www.kathrynclassic.com';

/**
 * Injects SportsEvent JSON-LD for the current tournament, sourced live from
 * Supabase (tournaments + tournament_events) instead of being hand-edited in
 * public/index.html every year. Render this on any page you want the markup
 * to appear on (Google's crawler executes JS, so a Helmet-injected script
 * tag is picked up the same as a static one).
 */
export default function EventSchema() {
  const [schema, setSchema] = useState(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const year = await getCurrentTournamentYear();
        const [tournament, events] = await Promise.all([
          getTournamentData(year),
          getTournamentEvents(year),
        ]);

        const golfEvent = events.find((e) => e.event_type === 'golf_tournament');
        if (cancelled || !tournament || !golfEvent) return;

        const startDate = golfEvent.start_time
          ? `${golfEvent.event_date}T${golfEvent.start_time}`
          : golfEvent.event_date;
        const endDate = golfEvent.end_time
          ? `${golfEvent.event_date}T${golfEvent.end_time}`
          : startDate;

        const availability = tournament.registration_status === 'open'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut';

        // No DB column tracks when registration opens; the Registration page's
        // own copy says "opens in March", so approximate validFrom as March 1
        // of the tournament year. Swap this out if a real date ever gets a column.
        const validFrom = `${year}-03-01T00:00:00-08:00`;

        const offers = golfEvent.price_tbd
          ? undefined
          : {
              '@type': 'Offer',
              name: 'Golf Tournament Registration',
              price: String(golfEvent.adult_price ?? ''),
              priceCurrency: 'USD',
              url: `${SITE_URL}/registration`,
              availability,
              validFrom,
            };

        setSchema({
          '@context': 'https://schema.org',
          '@type': 'SportsEvent',
          name: 'The Kathryn Classic Golf Tournament',
          description:
            tournament.tournament_summary ||
            'The annual Kathryn Classic charity golf tournament — a shotgun-start scramble supporting CJD research through the CJD Foundation, part of a weekend of family, golf & giving.',
          startDate,
          endDate,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          image: `${SITE_URL}/shedule_photos/pml_golf_course.jpg`,
          url: `${SITE_URL}/registration`,
          location: {
            '@type': 'Place',
            name: tournament.golf_course || tournament.location || 'Pine Mountain Lake Golf Course',
            address: {
              '@type': 'PostalAddress',
              addressLocality: 'Groveland',
              addressRegion: 'CA',
              postalCode: '95321',
              addressCountry: 'US',
            },
          },
          organizer: {
            '@type': 'Organization',
            name: 'The Kathryn Classic',
            url: SITE_URL,
          },
          performer: {
            '@type': 'PerformingGroup',
            name: 'The Kathryn Classic Tournament Field',
          },
          ...(offers ? { offers } : {}),
        });
      } catch (error) {
        console.error('Error building event structured data:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!schema) return null;

  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(schema)}</script>
    </Helmet>
  );
}
