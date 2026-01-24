import React from 'react';

const events = [
  {
    id: 1,
    name: 'Welcome Dinner',
    description: 'Join us for appetizers, drinks, and dinner at the Oceanview Clubhouse',
    date: 'Friday, June 10, 2025',
    time: '6:00 PM - 9:00 PM',
    location: 'Oceanview Clubhouse',
    details: [
      'Heavy appetizers and open bar',
      'Welcome remarks at 7:00 PM',
      'Dinner served at 7:30 PM',
      'Tournament overview and instructions',
      'Optional networking session after dinner'
    ]
  },
  {
    id: 2,
    name: 'Golf Tournament',
    description: '18-hole tournament with scramble format',
    date: 'Saturday, June 11, 2025',
    time: '8:00 AM - 4:00 PM',
    location: 'Bayview Golf Course',
    details: [
      'Check-in opens at 7:00 AM',
      'Shotgun start at 8:30 AM',
      'Lunch provided on the course',
      'Contests: Longest drive, closest to the pin, and more',
      'Post-round drinks and appetizers in the clubhouse'
    ]
  },
  {
    id: 3,
    name: 'Beach Day',
    description: 'A day of relaxation and activities for non-golfers',
    date: 'Saturday, June 11, 2025',
    time: '10:00 AM - 4:00 PM',
    location: 'Sunset Beach Resort',
    details: [
      'Transportation provided from hotel at 9:30 AM',
      'Beach activities including volleyball and paddleboarding',
      'Catered lunch at 12:30 PM',
      'Optional spa services (additional cost)',
      'Return transportation at 4:00 PM'
    ]
  },
  {
    id: 4,
    name: 'Awards Ceremony & Brunch',
    description: 'Tournament awards, charity recognition, and farewell brunch',
    date: 'Sunday, June 12, 2025',
    time: '10:00 AM - 1:00 PM',
    location: 'Oceanview Clubhouse',
    details: [
      'Brunch buffet opens at 10:00 AM',
      'Tournament results and awards at 11:30 AM',
      'Charity recognition and donation announcement',
      'Closing remarks and information for next year'
    ]
  }
];

export default function Schedule() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Tournament Schedule
          </h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Join us for a weekend of golf and community. Here's what to expect during The Kathryn Classic tournament weekend.
          </p>
        </div>
        
        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-2">
          {events.map((event) => (
            <article key={event.id} className="flex max-w-xl flex-col items-start">
              <div className="flex items-center gap-x-4 text-xs">
                <time dateTime={event.date} className="text-gray-500">
                  {event.date}
                </time>
                <span className="relative z-10 rounded-full bg-green-100 px-3 py-1.5 font-medium text-green-800">
                  {event.time}
                </span>
              </div>
              <div className="group relative">
                <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900 group-hover:text-gray-600">
                  {event.name}
                </h3>
                <p className="mt-5 line-clamp-3 text-sm leading-6 text-gray-600">
                  {event.description}
                </p>
              </div>
              
              <div className="mt-4 w-full">
                <h4 className="text-sm font-semibold text-gray-900">Location</h4>
                <p className="text-sm text-gray-600">{event.location}</p>
                
                <h4 className="mt-4 text-sm font-semibold text-gray-900">Details</h4>
                <ul className="mt-2 space-y-1 text-sm text-gray-600 list-disc pl-5">
                  {event.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}