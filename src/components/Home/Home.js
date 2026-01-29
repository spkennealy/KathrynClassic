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

const FloatingPhoto = ({ photo, position, delay }) => {
  return (
    <div
      className="absolute pointer-events-none z-0"
      style={{
        top: position.top,
        left: position.left,
        animation: `floatZoomFade 8s ease-in-out ${delay}s infinite`,
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
    // Set up individual intervals for each position to change photo after each animation cycle
    const timeouts = [];
    const intervals = [];

    photoPositions.forEach((_, index) => {
      const initialDelay = index * 0.8 * 1000; // Convert to milliseconds
      const animationDuration = 8000; // 8 seconds

      const timeout = setTimeout(() => {
        // After initial delay, set up repeating interval
        const interval = setInterval(() => {
          setFloatingPhotos(prevPhotos => {
            const newPhotos = [...prevPhotos];
            // Get a random photo that's different from the current one
            let newPhoto;
            do {
              newPhoto = photos[Math.floor(Math.random() * photos.length)];
            } while (newPhoto === newPhotos[index].photo && photos.length > 1);

            newPhotos[index] = {
              ...newPhotos[index],
              photo: newPhoto,
            };
            return newPhotos;
          });
        }, animationDuration);

        intervals.push(interval);
      }, initialDelay + animationDuration);

      timeouts.push(timeout);
    });

    // Cleanup all timeouts and intervals
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
      intervals.forEach(interval => clearInterval(interval));
    };
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
      <div className="relative bg-primary-600 px-6 py-24 sm:py-32 lg:py-40 overflow-hidden">
        {/* Floating Photos */}
        {floatingPhotos.map((item) => (
          <FloatingPhoto
            key={item.id}
            photo={item.photo}
            position={item.position}
            delay={item.delay}
          />
        ))}

        <div className="mx-auto max-w-4xl text-center relative z-20">
          <h1 className="text-5xl font-bold tracking-tight text-white sm:text-7xl font-serif">
            The Kathryn Classic
          </h1>
          <p className="mt-6 text-xl leading-8 text-white/90">
            Join us for a weekend of golf, community, and giving back. The annual Kathryn Classic tournament brings together golfers of all skill levels for a memorable experience while supporting CJD research through the CJD Foundation.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              to="/registration"
              className="rounded-lg bg-primary-700 px-6 py-3 text-lg font-semibold text-white shadow-sm hover:bg-primary-800 transition-colors font-serif"
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
      <div className="bg-primary-50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Honoring Kathryn */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-6xl mb-6">⛳</div>
              <h3 className="text-2xl font-bold text-primary-600 mb-4 font-serif">Honoring Kathryn</h3>
              <p className="text-base leading-7 text-gray-600 font-serif">
                An intimate gathering to celebrate Kathryn Rourick's legacy through golf, community, and remembrance.
              </p>
            </div>

            {/* Supporting CJD Research */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-6xl mb-6">💚</div>
              <h3 className="text-2xl font-bold text-primary-600 mb-4 font-serif">Supporting CJD Research</h3>
              <p className="text-base leading-7 text-gray-600 font-serif">
                100% of proceeds benefit the CJD Foundation, funding research and supporting families affected by Creutzfeldt-Jakob disease.
              </p>
            </div>

            {/* Building Community */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="text-6xl mb-6">🏆</div>
              <h3 className="text-2xl font-bold text-primary-600 mb-4 font-serif">Building Community</h3>
              <p className="text-base leading-7 text-gray-600 font-serif">
                A weekend bringing together family and friends who knew and loved Kathryn for golf, connection, and hope.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}