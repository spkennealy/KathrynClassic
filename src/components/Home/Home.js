import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentTournamentYear, getTournamentData, formatDateRange } from '../../utils/tournamentUtils';

// Fisher-Yates shuffle algorithm for proper randomization
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

export default function Home() {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  useEffect(() => {
    loadTournamentInfo();
    loadPhotos();
  }, []);

  // Slideshow rotation
  useEffect(() => {
    if (photos.length === 0) return;

    const interval = setInterval(() => {
      setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [photos.length]);

  const loadPhotos = async () => {
    try {
      const response = await fetch('/home_photos/manifest.json');
      const photoList = await response.json();
      setPhotos(shuffleArray(photoList));
    } catch (err) {
      console.error('Error loading photo manifest:', err);
    }
  };

  const loadTournamentInfo = async () => {
    try {
      const year = await getCurrentTournamentYear();
      const tournamentData = await getTournamentData(year);
      setTournament(tournamentData);
    } catch (err) {
      console.error('Error loading tournament info:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRegistrationStatus = () => {
    if (!tournament) return 'open';
    return tournament.registration_status || (tournament.registration_closed ? 'full' : 'open');
  };

  const getButtonText = () => {
    const status = getRegistrationStatus();
    if (status === 'closed') return 'Get Notified';
    if (status === 'full') return 'Join the Waitlist';
    return 'Register Now';
  };

  return (
    <div className="relative isolate overflow-hidden">
      {/* Hero Section */}
      <div className="relative bg-primary-600 px-4 sm:px-6 py-12 sm:py-24 lg:py-30 overflow-hidden">
        <div className="mx-auto max-w-4xl text-center relative z-20">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white font-serif">
            The Kathryn Classic
          </h1>
          <p className="mt-4 sm:mt-6 text-base sm:text-xl leading-7 sm:leading-8 text-white/90">
            Join us for a weekend of golf, community, and giving back. The annual Kathryn Classic tournament brings together golfers of all skill levels for a memorable experience while supporting CJD research through the CJD Foundation.<br /><br />
            Even if you don't play golf, we would love to have you join us for the welcome dinner, beach day, or other family activities.
          </p>
          <div className="mt-8 sm:mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/registration"
              className="rounded-lg bg-primary-700 px-6 py-3 text-base sm:text-lg font-semibold text-white shadow-sm hover:bg-primary-800 transition-colors font-serif"
            >
              {getButtonText()}
            </Link>
          </div>
          {/* Mobile-only hero photo */}
          {photos.length > 0 && (
            <div className="mt-8 flex justify-center md:hidden">
              <img
                src={photos[0]}
                alt="Kathryn memory"
                className="w-48 h-48 rounded-xl object-cover object-top shadow-lg ring-2 ring-white/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Photo Slideshow */}
      {photos.length > 0 && (
        <div className="bg-primary-50 py-8 sm:py-10">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="relative flex items-center justify-center" style={{ height: '60vw', maxHeight: '500px' }}>
              {photos.map((photo, index) => (
                <div
                  key={index}
                  className="absolute inset-0 transition-opacity duration-1000 flex items-center justify-center"
                  style={{ opacity: index === currentPhotoIndex ? 1 : 0 }}
                >
                  <img
                    src={photo}
                    alt={`Kathryn memory ${index + 1}`}
                    className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="bg-primary-50 pt-4 sm:pt-6 pb-16 sm:pb-24 lg:pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:gap-8 lg:grid-cols-3">
            {/* Honoring Kathryn */}
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">⛳</div>
              <h3 className="text-xl sm:text-2xl font-bold text-primary-600 mb-3 sm:mb-4 font-serif">Honoring Kathryn</h3>
              <p className="text-sm sm:text-base leading-6 sm:leading-7 text-gray-600 font-serif">
                An intimate gathering to celebrate Kathryn Rourick's legacy through golf, community, and remembrance.
              </p>
            </div>

            {/* Supporting CJD Research */}
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">💚</div>
              <h3 className="text-xl sm:text-2xl font-bold text-primary-600 mb-3 sm:mb-4 font-serif">Supporting CJD Research</h3>
              <p className="text-sm sm:text-base leading-6 sm:leading-7 text-gray-600 font-serif">
                100% of proceeds benefit the CJD Foundation, funding research and supporting families affected by Creutzfeldt-Jakob disease.
              </p>
            </div>

            {/* Building Community */}
            <div className="bg-white rounded-2xl shadow-lg p-6 sm:p-8">
              <div className="text-4xl sm:text-6xl mb-4 sm:mb-6">🏆</div>
              <h3 className="text-xl sm:text-2xl font-bold text-primary-600 mb-3 sm:mb-4 font-serif">Building Community</h3>
              <p className="text-sm sm:text-base leading-6 sm:leading-7 text-gray-600 font-serif">
                A weekend bringing together family and friends who knew and loved Kathryn for golf, connection, and hope.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
