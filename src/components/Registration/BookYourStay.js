import React from 'react';

const LODGING_LINKS = [
  {
    name: 'Airbnb',
    href: 'https://www.airbnb.com/s/Pine-Mountain-Lake--CA/homes?refinement_paths%5B%5D=%2Fhomes&query=Pine%20Mountain%20Lake%2C%20CA&place_id=ChIJ-fLKZwLVkIARuPDY1XQNMY4&search_mode=regular_search&date_picker_type=calendar&checkin=2026-09-18&checkout=2026-09-20&source=structured_search_input_header&search_type=unknown',
    domain: 'airbnb.com',
  },
  {
    name: 'VRBO',
    // Free-text "Pine Mountain Lake" snaps to nearby Sonora; this regionId/latLong pins it correctly.
    href: 'https://www.vrbo.com/search?q=Pine+Mountain+Lake%2C+CA&destination=Pine+Mountain+Lake%2C+Groveland%2C+California%2C+United+States+of+America&regionId=6239647&latLong=37.851688%2C-120.197174&startDate=2026-09-18&endDate=2026-09-20&adults=2&sort=RECOMMENDED',
    domain: 'vrbo.com',
  },
  {
    name: 'Yosemite Region Resorts',
    href: 'https://www.yosemiteregionresorts.com/listings?dates=09/18/26|09/20/26&keywords=pine%20mountain%20lake',
    domain: 'yosemiteregionresorts.com',
    // Google/DuckDuckGo don't index this site's favicon, so point at the one it declares directly.
    icon: 'https://domuy5fxwbmsn.cloudfront.net/image/45c52e13-3a61-4edb-9376-c05faf2ab175/favicon_image.gif',
  },
];

const iconUrl = (link) =>
  link.icon || `https://www.google.com/s2/favicons?domain=${link.domain}&sz=64`;

export default function BookYourStay({ className = '' }) {
  return (
    <div className={`rounded-lg bg-white dark:bg-night-800 p-4 sm:p-6 lg:p-8 shadow-sm ring-1 ring-gray-200 dark:ring-night-700 ${className}`}>
      <h3 className="text-xl sm:text-2xl font-bold text-primary-600 dark:text-primary-400 font-serif text-center">
        Book Your Stay
      </h3>
      <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 text-center">
        The Kathryn Classic is held at Pine Mountain Lake, CA. Find a place to stay through one of these options:
      </p>
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LODGING_LINKS.map((link) => (
          <a
            key={link.name}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-lg border border-primary-600 dark:border-primary-400 bg-white dark:bg-night-700 px-4 py-3 text-center text-sm font-medium text-primary-600 dark:text-primary-300 shadow-sm hover:bg-primary-50 dark:hover:bg-night-600 transition-colors"
          >
            <img
              src={iconUrl(link)}
              alt=""
              aria-hidden="true"
              className="h-5 w-5 flex-shrink-0 rounded-sm"
            />
            {link.name}
          </a>
        ))}
      </div>
    </div>
  );
}
