import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getCurrentTournamentYear, getTournamentData, formatDateRange } from '../../utils/tournamentUtils';

const photos = [
  '/kathryn_photos/Kiley-Kyle_Tre-Posti-Wedding_Hannah-Berglund-Photography_Family Photos-15.jpg',
  '/kathryn_photos/kahtryn_high_school.jpg',
  '/kathryn_photos/kahtryn_high_school_2.jpg',
  '/kathryn_photos/kathryn_all_sisters.jpg',
  '/kathryn_photos/kathryn_emmie_christmas.jpg',
  '/kathryn_photos/kathryn_jackie.jpg',
  '/kathryn_photos/kathryn_jackie_jenna_chelsea_kierstryn_winery.jpg',
  '/kathryn_photos/kathryn_jackie_pml.JPG',
  '/kathryn_photos/kathryn_kierstyn_winery.jpg',
  '/kathryn_photos/kathryn_kyle_kierstyn_jenna_wedding.jpg',
  '/kathryn_photos/kathryn_terry_kyle_kierstyn.jpg',
  '/kathryn_photos/IMG_0241.JPG',
  '/kathryn_photos/IMG_2826.JPG',
  '/kathryn_photos/IMG_9186.JPG',
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

const FloatingPhoto = ({ photo, position, delay }) => {
  return (
    <div
      className="absolute pointer-events-none z-0"
      style={{
        top: position.top,
        left: position.left,
        animation: `floatZoomFade 12s ease-in-out ${delay}s infinite`,
      }}
    >
      <img
        src={photo}
        alt="Kathryn memory"
        className="w-20 h-20 sm:w-28 sm:h-28 rounded-lg object-cover shadow-lg"
      />
    </div>
  );
};

// Fixed positions for photos - 5 on left, 5 on right, vertically centered with less overlap
const photoPositions = [
  // Left side positions
  { top: '15%', left: '5%' },
  { top: '28%', left: '8%' },
  { top: '42%', left: '5%' },
  { top: '56%', left: '10%' },
  { top: '70%', left: '7%' },
  // Right side positions
  { top: '17%', left: '87%' },
  { top: '30%', left: '90%' },
  { top: '44%', left: '85%' },
  { top: '58%', left: '88%' },
  { top: '72%', left: '92%' },
];

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

  // Initialize with shuffled photos
  const [floatingPhotos, setFloatingPhotos] = useState(() => {
    const shuffled = shuffleArray(photos);
    return photoPositions.map((position, index) => ({
      photo: shuffled[index % photos.length],
      position,
      delay: index * 0.8,
      id: index,
    }));
  });

  useEffect(() => {
    loadTournamentInfo();
  }, []);

  useEffect(() => {
    // Single coordinated timer to avoid race conditions between per-position timers.
    // Each position's animation is 12s with a stagger of 0.8s.
    // Photo swaps happen at 95% of each position's animation cycle (when faded out).
    const animationDuration = 12000;
    const stagger = 800;
    const swapPoint = animationDuration * 0.95;

    // Calculate when each position next needs a photo change
    const nextChangeTime = photoPositions.map((_, index) => {
      return index * stagger + swapPoint;
    });

    const startTime = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;

      // Find all positions that need a photo change this tick
      const positionsToUpdate = [];
      for (let i = 0; i < photoPositions.length; i++) {
        if (elapsed >= nextChangeTime[i]) {
          positionsToUpdate.push(i);
          nextChangeTime[i] += animationDuration;
        }
      }

      if (positionsToUpdate.length === 0) return;

      // Single atomic state update for all positions that need changing
      setFloatingPhotos(prevPhotos => {
        const newPhotos = [...prevPhotos];

        positionsToUpdate.forEach(index => {
          const currentlyUsed = new Set(newPhotos.map(p => p.photo));
          currentlyUsed.delete(newPhotos[index].photo);
          const available = photos.filter(p => !currentlyUsed.has(p));

          if (available.length > 0) {
            newPhotos[index] = {
              ...newPhotos[index],
              photo: available[Math.floor(Math.random() * available.length)],
            };
          }
        });

        return newPhotos;
      });
    }, 400); // Check frequently enough to catch each position's swap point

    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="relative isolate overflow-hidden">
      {/* Hero Section */}
      <div className="relative bg-primary-600 px-4 sm:px-6 py-16 sm:py-32 lg:py-40 overflow-hidden">
        {/* Floating Photos - masked to fade out before reaching center text */}
        <div
          className="absolute inset-0 z-0 hidden lg:block"
          style={{
            maskImage: 'linear-gradient(to right, black 0%, black 12%, transparent 22%, transparent 78%, black 88%, black 100%)',
            WebkitMaskImage: 'linear-gradient(to right, black 0%, black 12%, transparent 22%, transparent 78%, black 88%, black 100%)',
          }}
        >
          {floatingPhotos.map((item) => (
            <FloatingPhoto
              key={item.id}
              photo={item.photo}
              position={item.position}
              delay={item.delay}
            />
          ))}
        </div>

        <div className="mx-auto max-w-4xl text-center relative z-20">
          <h1 className="text-3xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-white font-serif">
            The Kathryn Classic
          </h1>
          {/* Hero photo - shown when floating photos aren't visible */}
          <div className="mt-6 flex justify-center lg:hidden">
            <img
              src="/kathryn_photos/kathryn_jackie_pml.JPG"
              alt="Kathryn and Jackie"
              className="w-48 h-48 rounded-xl object-cover object-top shadow-lg ring-2 ring-white/30"
            />
          </div>
          <p className="mt-4 sm:mt-6 text-base sm:text-xl leading-7 sm:leading-8 text-white/90">
            Join us for a weekend of golf, community, and giving back. The annual Kathryn Classic tournament brings together golfers of all skill levels for a memorable experience while supporting CJD research through the CJD Foundation.<br /><br />
            Even if you don't play golf, we would love to have you join us for the welcome dinner, beach day, or other family activities.
          </p>
          <div className="mt-8 sm:mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/registration"
              className="rounded-lg bg-primary-700 px-6 py-3 text-base sm:text-lg font-semibold text-white shadow-sm hover:bg-primary-800 transition-colors font-serif"
            >
              Register Now
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes floatZoomFade {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          15% {
            opacity: 0.7;
            transform: scale(1);
          }
          70% {
            opacity: 0.7;
            transform: scale(1.2);
          }
          85% {
            opacity: 0.4;
            transform: scale(1.4);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }
      `}</style>

      {/* Features Section */}
      <div className="bg-primary-50 py-16 sm:py-24 lg:py-32">
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