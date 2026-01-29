import React, { useState, useEffect } from 'react';

const photos = [
  '/kathryn_photos/Kiley-Kyle_Tre-Posti-Wedding_Hannah-Berglund-Photography_Family Photos-15.jpg',
  '/kathryn_photos/kahtryn_high_school.jpg',
  '/kathryn_photos/kahtryn_high_school_2.jpg',
  '/kathryn_photos/kathryn_all_sisters.jpg',
  '/kathryn_photos/kathryn_emmie_christmas.jpg',
  '/kathryn_photos/kathryn_jackie.jpg',
  '/kathryn_photos/kathryn_jackie_jenna_chelsea_kierstryn_winery.jpg',
  '/kathryn_photos/kathryn_kierstyn_winery.jpg',
  '/kathryn_photos/kathryn_kyle_kierstyn_jenna_wedding.jpg',
  '/kathryn_photos/kathryn_terry_kyle_kierstyn.jpg',
  '/kathryn_photos/type=1&locId=074E31BD-A112-4E15-91D1-3EE7E8A2BDBC_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
  '/kathryn_photos/type=1&locId=3867D7D7-AAB8-4817-B19D-A9F8736FEE93_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
  '/kathryn_photos/type=1&locId=5FA5C637-E1E1-4ED2-B827-55B08E960050_L0_001&adj=1&modificationDate=2017-09-07_18-42-24_-0700.jpg',
  '/kathryn_photos/type=1&locId=6225E66D-4283-44EC-836E-D04EFFACE315_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
  '/kathryn_photos/type=1&locId=7569FF24-9EC6-431D-BE5F-AAEB01CAAE58_L0_001&adj=1&modificationDate=2022-10-19_03-26-48_-0700.jpg',
  '/kathryn_photos/type=1&locId=8635F6DA-A00E-4D29-8963-4270E44D3244_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
  '/kathryn_photos/type=1&locId=C1DDEBB8-CD32-4C6C-95D3-82BDDC7F4F78_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
  '/kathryn_photos/type=1&locId=C6A59FA6-136E-40FD-B998-3B295429C9E9_L0_001&adj=1&modificationDate=2023-09-15_14-05-48_-0700.jpg',
  '/kathryn_photos/type=1&locId=F17B6198-88A9-4690-97D7-FF77E71BF947_L0_001&adj=1&modificationDate=2023-09-15_14-05-48_-0700.jpg',
  '/kathryn_photos/type=1&locId=FD6D315A-B90A-4702-B19D-B52812297F34_L0_001&adj=1&modificationDate=2023-09-15_13-41-28_-0700.jpg',
];

export default function About() {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % photos.length);
    }, 4000); // Change photo every 4 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-primary-50 min-h-screen">
      {/* Main Content */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-primary-600 sm:text-5xl font-serif">
              About the Kathryn Classic
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 font-serif">
              An intimate charity golf tournament bringing together family, friends, and community to honor Kathryn's memory
              and support CJD research and awareness.
            </p>
          </div>

          {/* Photo Slideshow */}
          <div className="mb-16">
            <div className="relative flex items-center justify-center" style={{ minHeight: '500px', maxHeight: '600px' }}>
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="absolute inset-0 transition-opacity duration-1000 flex items-center justify-center"
                  style={{
                    opacity: index === currentPhotoIndex ? 1 : 0,
                  }}
                >
                  <img
                    src={photo}
                    alt={`Kathryn memory ${index + 1}`}
                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  />
                </div>
              ))}
              {/* Slideshow indicators */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-10">
                {photos.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentPhotoIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentPhotoIndex
                        ? 'bg-primary-600 w-8'
                        : 'bg-primary-400 hover:bg-primary-500'
                    }`}
                    aria-label={`Go to photo ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* In Loving Memory Box */}
          <div className="mb-16">
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-3xl font-bold text-primary-600 text-center mb-8 font-serif">
                In Loving Memory of Kathryn Rourick
              </h2>
              <div className="space-y-4 text-base leading-7 text-gray-600 font-serif">
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

          {/* Timeline Cards */}
          <div className="space-y-6">
            {/* First Tournament */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">🏆</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 font-serif">
                    First Tournament
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">2025</p>
                  <p className="text-base leading-7 text-gray-600 font-serif">
                    The inaugural Kathryn Classic brought together family, friends, and community to honor Kathryn's memory and launch what would become an annual tradition of golf, remembrance, and support for CJD research.
                  </p>
                </div>
              </div>
            </div>

            {/* Building Community */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">📈</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 font-serif">
                    Building Community
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Ongoing</p>
                  <p className="text-base leading-7 text-gray-600 font-serif">
                    Each year, The Kathryn Classic brings together approximately 30 golfers and 70-80 total attendees who knew and loved Kathryn. Our intimate tournament creates meaningful connections while raising funds and awareness for the CJD Foundation.
                  </p>
                </div>
              </div>
            </div>

            {/* Supporting Research */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">⭐</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 font-serif">
                    Supporting Research
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Our Mission</p>
                  <p className="text-base leading-7 text-gray-600 font-serif">
                    100% of proceeds from The Kathryn Classic benefit the CJD Foundation, funding critical research and supporting families affected by Creutzfeldt-Jakob disease. Together, we're working toward a future where other families won't face this devastating disease.
                  </p>
                </div>
              </div>
            </div>

            {/* Looking Forward */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">💪</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 font-serif">
                    Looking Forward
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">Our Future</p>
                  <p className="text-base leading-7 text-gray-600 font-serif">
                    As we continue Kathryn's legacy, each tournament strengthens our community and deepens our commitment to CJD research and awareness. We're honored to keep her memory alive through this annual gathering of family and friends.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}