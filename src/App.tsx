import { Routes, Route } from 'react-router-dom';
import Home from './Home';
import ErrorScreen from './ErrorScreen';
import CookieBanner from './CookieBanner';
import { useUser } from './UserContext';

export default function App() {
  const { serverError } = useUser();

  if (serverError) {
    return <ErrorScreen />;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video/:id" element={<Home />} />
      </Routes>
      <CookieBanner />
    </>
  );
}
