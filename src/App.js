import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import Home from './components/Home/Home';
import Schedule from './components/Schedule/Schedule';
import Registration from './components/Registration/Registration';
import Donations from './components/Donations/Donations';
import About from './components/About/About';
import TournamentHistory from './components/TournamentHistory/TournamentHistory';

function App() {
  return (
    <Router>
      <div className="App min-h-screen flex flex-col bg-white">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/registration" element={<Registration />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/about" element={<About />} />
            <Route path="/history" element={<TournamentHistory />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
