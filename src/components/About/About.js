import React from 'react';

export default function About() {
  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl lg:mx-0 lg:max-w-4xl">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl text-center">About The Kathryn Classic</h2>
          <p className="mt-6 text-lg leading-8 text-gray-600 text-center">
            An intimate charity golf tournament bringing together family, friends, and community to honor Kathryn's memory
            and support CJD research and awareness.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl border-t border-gray-200 pt-16">
          <div className="bg-gray-50 rounded-lg p-8 shadow-sm ring-1 ring-gray-900/5">
            <h3 className="text-2xl font-semibold leading-8 tracking-tight text-gray-900 text-center mb-8">In Loving Memory of Kathryn Rourick</h3>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                With full hearts and deep gratitude, we honor the life of Kathryn Rourick, who left us on February 6, 2023 due to Creutzfeldt‑Jakob disease. She was a loving mother, wife, sister, grandmother, and friend whose presence made every room warmer and every day brighter.
              </p>
              <p>
                As a mother and grandmother, Kathryn was both soft and strong—encouraging, practical, and endlessly proud. As a sister and friend, she listened deeply, laughed easily, and always showed up.
              </p>
              <p>
                Kathryn's legacy lives in the way her family gathers, the way her friends care for one another, and the way those who worked beside her carry forward her standard of kindness.
              </p>
              <p className="italic">
                Forever loved, forever missed—Kathryn remains with us in every shared story, in every celebration, with each phase of the Grandma moon, and in the quiet moments that remind us of her joy. May her memory be a blessing, and may continued research and awareness bring hope to families facing CJD today and in the years to come.
              </p>
              <p className="text-right font-medium text-gray-700 mt-6">
                — With love from her family and friends
              </p>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-16 max-w-3xl lg:mx-0 lg:max-w-4xl">
          <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Our Tournament</h3>
          <p className="mt-4 text-base leading-7 text-gray-600">
            The Kathryn Classic is an intimate annual gathering of approximately 30 golfers and 70-80 total attendees.
            Our tournament brings together those who knew and loved Kathryn for a weekend of golf, community, and remembrance
            while raising funds and awareness for the CJD Foundation.
          </p>
          <p className="mt-4 text-base leading-7 text-gray-600">
            What makes our tournament special is its personal nature—every participant has a connection to Kathryn's story,
            and together we create a meaningful weekend that celebrates her life while supporting critical research into
            Creutzfeldt-Jakob disease.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-3xl lg:mx-0 lg:max-w-4xl">
          <h3 className="text-xl font-semibold leading-8 tracking-tight text-gray-900">Supporting CJD Research</h3>
          <p className="mt-4 text-base leading-7 text-gray-600">
            All proceeds from The Kathryn Classic benefit the CJD Foundation, which is dedicated to providing support for CJD families,
            educating healthcare professionals, funding research, and serving as an advocate for families with loved ones who have
            Creutzfeldt-Jakob disease.
          </p>
          <p className="mt-4 text-base leading-7 text-gray-600">
            Through this tournament, we hope to raise awareness about CJD and contribute to research that will one day help other
            families facing this devastating disease.
          </p>
        </div>
      </div>
    </div>
  );
}