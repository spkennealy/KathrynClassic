import React from 'react';

export default function About() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">About The Kathryn Classic</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            The Kathryn Classic is an annual charity golf tournament dedicated to bringing the community together
            while raising funds for important causes.
          </p>
        </div>
        
        <div className="mx-auto mt-10 max-w-2xl lg:mx-0 lg:max-w-none">
          <div className="grid grid-cols-1 gap-y-16 gap-x-8 lg:grid-cols-2">
            <div>
              <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Our Story</h3>
              <p className="mt-4 text-base leading-7 text-gray-600">
                The Kathryn Classic was founded in 2025 to honor Kathryn Johnson, whose passion for golf was matched only by her
                commitment to community service. After her passing in 2024, her family and friends established this tournament to
                continue her legacy of bringing people together and giving back.
              </p>
              <p className="mt-4 text-base leading-7 text-gray-600">
                What began as a small gathering of golf enthusiasts has grown into a premier annual event that attracts participants
                from across the region. Each year, we select a charitable cause to support, focusing on organizations that were
                important to Kathryn.
              </p>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Our Mission</h3>
              <p className="mt-4 text-base leading-7 text-gray-600">
                The Kathryn Classic aims to create a memorable weekend that celebrates community, competition, and compassion.
                Our mission is to honor Kathryn's memory by:
              </p>
              <ul className="mt-4 space-y-3 text-base leading-7 text-gray-600 list-disc pl-5">
                <li>Hosting a premier golf tournament that welcomes players of all skill levels</li>
                <li>Raising funds for meaningful charitable causes</li>
                <li>Creating opportunities for community building and networking</li>
                <li>Promoting the game of golf and its values of integrity, perseverance, and sportsmanship</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="mx-auto mt-16 max-w-2xl lg:mx-0 lg:max-w-none">
          <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">This Year's Charitable Focus</h3>
          <p className="mt-4 text-base leading-7 text-gray-600">
            For our inaugural tournament, we are proud to support the Children's Hospital Foundation. The funds raised will
            help provide critical medical equipment for the pediatric oncology department, a cause that was deeply important to Kathryn
            during her lifetime.
          </p>
          <p className="mt-4 text-base leading-7 text-gray-600">
            Last year, the Children's Hospital Foundation treated over 5,000 young cancer patients, and our goal is to contribute to
            their ongoing mission of providing world-class care to every child, regardless of their family's financial situation.
          </p>
        </div>
        
        <div className="mx-auto mt-16 max-w-2xl lg:mx-0 lg:max-w-none">
          <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Organizing Committee</h3>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-16 border-t border-gray-200 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
            {[
              {
                name: 'Michael Johnson',
                role: 'Tournament Chair',
                description: "Kathryn's brother and founder of The Kathryn Classic. Michael is a lifelong golfer and community activist.",
              },
              {
                name: 'Sarah Reynolds',
                role: 'Event Coordinator',
                description: "Sarah brings 15 years of event planning experience and was Kathryn's closest friend for over two decades.",
              },
              {
                name: 'David Martinez',
                role: 'Sponsorship Director',
                description: 'David leads our fundraising efforts and builds relationships with sponsors and community partners.',
              },
              {
                name: 'Jennifer Wong',
                role: 'Volunteer Coordinator',
                description: 'Jennifer manages our team of dedicated volunteers who make the tournament weekend possible.',
              },
              {
                name: 'Robert Thompson',
                role: 'Golf Director',
                description: 'PGA professional Robert oversees all aspects of the tournament competition and course setup.',
              },
              {
                name: 'Lisa Chen',
                role: 'Marketing Director',
                description: 'Lisa handles our communications, social media presence, and promotional materials.',
              },
            ].map((person) => (
              <div key={person.name} className="flex max-w-xl flex-col items-start">
                <div className="group relative">
                  <h3 className="mt-3 text-lg font-semibold leading-6 text-gray-900">{person.name}</h3>
                  <p className="text-sm text-green-800 font-medium">{person.role}</p>
                  <p className="mt-3 text-sm leading-6 text-gray-600">{person.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mx-auto mt-16 max-w-2xl border-t border-gray-900/10 pt-12 lg:mx-0 lg:max-w-none">
          <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Contact Us</h3>
          <p className="mt-4 text-base leading-7 text-gray-600">
            Have questions about The Kathryn Classic? We'd love to hear from you.
          </p>
          <div className="mt-4 text-base leading-7 text-gray-600">
            <p>Email: info@kathrynclassic.org</p>
            <p>Phone: (555) 123-4567</p>
            <p>Address: 123 Golf Club Road, Fairway Hills, CA 94123</p>
          </div>
        </div>
      </div>
    </div>
  );
}