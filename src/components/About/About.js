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
                    The inaugural Kathryn Classic brought together family, friends, and community to honor Kathryn's memory and launch what would become an annual tradition of family gatherings, golf, remembrance, and support for CJD research.
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