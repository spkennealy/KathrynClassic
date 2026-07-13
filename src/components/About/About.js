import React, { useState, useEffect, useRef, useCallback } from 'react';

const videoExtensions = ['.mov', '.mp4', '.webm'];
const isVideo = (src) => videoExtensions.some(ext => src.toLowerCase().endsWith(ext));

export default function About() {
  const [photos, setPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    fetch('/about_photos/manifest.json')
      .then(res => res.json())
      .then(setPhotos)
      .catch(err => console.error('Error loading about photos:', err));
  }, []);

  const advanceSlide = useCallback(() => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  }, [photos.length]);

  useEffect(() => {
    if (photos.length === 0) return;
    clearTimeout(timerRef.current);

    if (!isVideo(photos[currentPhotoIndex])) {
      timerRef.current = setTimeout(advanceSlide, 4000);
    }

    return () => clearTimeout(timerRef.current);
  }, [currentPhotoIndex, photos, advanceSlide]);

  return (
    <div className="bg-primary-50 dark:bg-night-900 min-h-screen">
      {/* Main Content */}
      <div className="pt-10 pb-24 sm:pt-14 sm:pb-32">
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold tracking-tight text-primary-600 dark:text-primary-400 sm:text-5xl font-serif">
              About the Kathryn Classic
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
              A weekend filled with family and friends coming together to honor Kathryn's memory and support CJD research and awareness, featuring a charity golf tournament and other activities.
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
                  {isVideo(photo) ? (
                    <video
                      src={index === currentPhotoIndex ? photo : undefined}
                      autoPlay={index === currentPhotoIndex}
                      muted
                      playsInline
                      onEnded={advanceSlide}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  ) : (
                    <img
                      src={photo}
                      alt={`Kathryn memory ${index + 1}`}
                      className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                  )}
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
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <h2 className="text-3xl font-bold text-primary-600 dark:text-primary-400 text-center mb-8 font-serif">
                In Loving Memory of Kathryn Rourick
              </h2>
              <div className="space-y-4 text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
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
                <p className="text-right font-medium text-gray-700 dark:text-gray-300 mt-6">
                  — With love from her family and friends
                </p>
              </div>
            </div>
          </div>

          {/* Timeline Cards */}
          <div className="space-y-6">
            {/* First Tournament */}
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">🏆</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-serif">
                    First Tournament
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">2025</p>
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                    The inaugural Kathryn Classic brought together family, friends, and community to honor Kathryn's memory and launch what would become an annual tradition of family gatherings, golf, remembrance, and support for CJD research.
                  </p>
                </div>
              </div>
            </div>

            {/* Building Community */}
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">📈</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-serif">
                    Building Community
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Ongoing</p>
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                    Each year, The Kathryn Classic brings together approximately 30 golfers and 70-80 total attendees who knew and loved Kathryn. Our intimate tournament creates meaningful connections while raising funds and awareness for the CJD Foundation.
                  </p>
                </div>
              </div>
            </div>

            {/* Supporting Research */}
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">⭐</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-serif">
                    Supporting Research
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Our Mission</p>
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                    100% of proceeds from The Kathryn Classic benefit the CJD Foundation, funding critical research and supporting families affected by Creutzfeldt-Jakob disease. Together, we're working toward a future where other families won't face this devastating disease.
                  </p>
                </div>
              </div>
            </div>

            {/* Looking Forward */}
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <div className="flex items-center gap-6">
                <div className="text-6xl">💪</div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-serif">
                    Looking Forward
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Our Future</p>
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                    As we continue Kathryn's legacy, each tournament strengthens our community and deepens our commitment to CJD research and awareness. We're honored to keep her memory alive through this annual gathering of family and friends.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Support / Donations */}
          <div className="mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tight text-primary-600 dark:text-primary-400 sm:text-4xl font-serif">
                Support The Kathryn Classic
              </h2>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-400 font-serif">
                Your donation helps fund CJD research and raises awareness for Creutzfeldt-Jakob disease.
                All donations are tax-deductible and go directly to the CJD Foundation.
              </p>
            </div>

            {/* Donation Information Card */}
            <div className="mb-8">
              <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
                <div className="text-center">
                  <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                    We welcome donations of any amount. Most of our supporters contribute around $100,
                    with contributions ranging from small gifts to $500 or more. Every donation makes a difference
                    in funding research and supporting families affected by CJD.
                  </p>
                </div>
              </div>
            </div>

            {/* Donation Button Card */}
            <div className="mb-8">
              <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-12">
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-4 font-serif">Make a Donation Today</h3>
                  <p className="text-base text-gray-600 dark:text-gray-400 mb-8 max-w-xl mx-auto font-serif">
                    Your contribution supports vital research and provides critical resources for families affected by Creutzfeldt-Jakob disease.
                  </p>
                  <a
                    href="https://secure.qgiv.com/event/cjdfoundation/account/2161631/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-primary-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 transition-all hover:scale-105"
                  >
                    Donate to CJD Foundation
                    <svg className="ml-2 h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </a>
                  <p className="mt-4 text-sm text-gray-600 dark:text-gray-400 font-serif">
                    Opens in a new window
                  </p>
                </div>
              </div>
            </div>

            {/* About CJD Foundation Card */}
            <div className="bg-white dark:bg-night-800 rounded-2xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-primary-600 dark:text-primary-400 text-center mb-6 font-serif">About the CJD Foundation</h3>

              <div className="space-y-4 text-base leading-7 text-gray-600 dark:text-gray-400 font-serif">
                <p>
                  The CJD Foundation is a registered 501(c)(3) non-profit organization dedicated to supporting families affected by prion disease,
                  specifically Creutzfeldt-Jakob Disease (CJD). The foundation has earned a 4-Star Rating from Charity Navigator.
                </p>

                <div className="mt-8">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">What They Do</h4>

                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100">Direct Family Support:</h5>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Operate a toll-free helpline (1-800-659-1991) available 7 days a week</li>
                        <li>Offer referrals, support groups, and educational webinars</li>
                        <li>Host an annual family conference bringing together affected families and medical experts</li>
                        <li>Provide end-of-life planning resources and caregiver support</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100">Research & Education:</h5>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Award research grants through their Family Memorial Research Grants program</li>
                        <li>Partner with scientists and clinicians on prion disease research</li>
                        <li>Educate medical professionals, funeral professionals, and caregivers</li>
                        <li>Collaborate with international patient associations and health authorities</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100">Advocacy:</h5>
                      <ul className="list-disc list-inside space-y-1 mt-2">
                        <li>Maintain a memory quilt tribute to those affected</li>
                        <li>Operate a prion disease registry</li>
                        <li>Conduct advocacy initiatives in Washington, D.C.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-base bg-primary-50 dark:bg-night-700/40 p-4 rounded-lg border border-primary-200 dark:border-night-600">
                  <strong>The Need:</strong> In the United States, approximately 500 new CJD cases are diagnosed annually,
                  with a global incidence of one to two cases per million people per year. Your generous donations help continue
                  vital research into finding treatments and ultimately a cure for this devastating disease.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}