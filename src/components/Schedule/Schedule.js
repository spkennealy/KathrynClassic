import React, { useState, useEffect } from 'react';
import { getCurrentTournamentYear, getTournamentEvents, formatDate, formatTime } from '../../utils/tournamentUtils';

export default function Schedule() {
  const [events, setEvents] = useState([]);
  const [tournamentYear, setTournamentYear] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchedule();
  }, []);

  const loadSchedule = async () => {
    try {
      const year = await getCurrentTournamentYear();
      setTournamentYear(year);

      const eventData = await getTournamentEvents(year);
      setEvents(eventData);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatEventTime = (startTime, endTime) => {
    const start = formatTime(startTime);
    const end = formatTime(endTime);

    if (!start && !end) return '';
    if (!end) return start;

    return `${start} - ${end}`;
  };

  if (loading) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              Tournament Schedule
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Schedule details will be posted soon. Check back later for the full tournament schedule.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            {tournamentYear} Tournament Schedule
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Join us for a weekend of golf and community. Here's what to expect during The Kathryn Classic tournament weekend.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {events.map((event) => (
            <article key={event.id} className="flex max-w-xl flex-col items-start">
              <div className="flex items-center gap-x-4 text-xs">
                <time dateTime={event.event_date} className="text-gray-500">
                  {formatDate(event.event_date)}
                </time>
                <span className="relative z-10 rounded-full bg-primary-100 px-3 py-1.5 font-medium text-primary-700">
                  {formatEventTime(event.start_time, event.end_time)}
                </span>
              </div>
              <div className="group relative">
                <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                  {event.event_name}
                </h3>
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                  {event.description}
                </p>
              </div>

              <div className="mt-4 w-full">
                <h4 className="text-sm font-semibold text-gray-900">Location</h4>
                <p className="text-sm text-gray-600">{event.location}</p>

                {event.host && (
                  <>
                    <h4 className="mt-4 text-sm font-semibold text-gray-900">Host</h4>
                    <p className="text-sm text-gray-600">{event.host}</p>
                  </>
                )}

                {event.details && event.details.length > 0 && (
                  <>
                    <h4 className="mt-4 text-sm font-semibold text-gray-900">Details</h4>
                    <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                      {event.details.map((detail, index) => (
                        <li key={index}>{detail}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}