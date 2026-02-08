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

  const getTimeOfDay = (startTime) => {
    if (!startTime) return 'All Day';
    const hour = parseInt(startTime.split(':')[0]);
    if (hour < 12) return 'Morning';
    if (hour < 17) return 'Afternoon';
    return 'Evening';
  };

  const groupEventsByDate = (events) => {
    const grouped = {};
    events.forEach(event => {
      const date = event.event_date;
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(event);
    });

    // Sort events within each date by start_time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        // Handle null/undefined times (put them at the end)
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;

        // Compare times (format: "HH:MM:SS" or "HH:MM")
        return a.start_time.localeCompare(b.start_time);
      });
    });

    return grouped;
  };

  const formatDateHeader = (dateString) => {
    const date = new Date(dateString + 'T00:00:00');
    const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  if (loading) {
    return (
      <div className="bg-primary-50 py-24 sm:py-32 min-h-screen">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-lg text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-primary-50 py-24 sm:py-32 min-h-screen">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight text-primary-600 sm:text-5xl font-serif">
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

  const groupedEvents = groupEventsByDate(events);

  // Sort dates chronologically
  const sortedDates = Object.entries(groupedEvents).sort((a, b) => {
    return a[0].localeCompare(b[0]); // Compare date strings (YYYY-MM-DD format)
  });

  return (
    <div className="bg-primary-50 py-24 sm:py-32 min-h-screen">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold tracking-tight text-primary-600 sm:text-5xl font-serif">
            Tournament Schedule
          </h2>
        </div>

        {sortedDates.map(([date, dateEvents]) => (
          <div key={date} className="mb-12">
            {/* Date Header */}
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-primary-600 font-serif">
                {formatDateHeader(date)}
              </h3>
            </div>

            {/* Events for this date */}
            <div className="space-y-6">
              {dateEvents.map((event) => (
                <div key={event.id} className="bg-white rounded-2xl shadow-lg p-8 flex flex-col sm:flex-row gap-6 sm:items-center">
                  {/* Time Section */}
                  <div className="sm:w-48 flex-shrink-0 text-center">
                    <div className="text-4xl font-bold text-primary-600 font-serif">
                      {formatTime(event.start_time)}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {getTimeOfDay(event.start_time)}
                    </div>
                  </div>

                  {/* Content Section */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-primary-600 mb-3 font-serif">
                      {event.event_name}
                    </h3>
                    <p className="text-base leading-7 text-gray-600 font-serif mb-4">
                      {event.description}
                    </p>

                    {event.location && (
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-gray-900">📍 Location: </span>
                        {event.map_link ? (
                          <a href={event.map_link} target="_blank" rel="noopener noreferrer" className="text-sm text-primary-600 hover:text-primary-800 underline">
                            {event.location}
                          </a>
                        ) : (
                          <span className="text-sm text-gray-600">{event.location}</span>
                        )}
                      </div>
                    )}

                    {event.host && (
                      <div className="mb-2">
                        <span className="text-sm font-semibold text-gray-900">👤 Host: </span>
                        <span className="text-sm text-gray-600">{event.host}</span>
                      </div>
                    )}

                    {event.details && event.details.length > 0 && (
                      <div className="mt-3">
                        <ul className="space-y-1 text-sm text-gray-600">
                          {event.details.map((detail, index) => (
                            <li key={index} className="flex items-start">
                              <span className="mr-2">•</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}