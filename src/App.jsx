import OverlayLayout from './components/OverlayLayout';
import LandingPage from './components/LandingPage';
import { OBSProvider } from './context/OBSContext';

function App() {
  // The marketing home page owns the bare `/` so search engines index it;
  // any editor/OBS param (?room, ?obs, ?studio) opens the app instead, so
  // every existing ?room/?obs link is unaffected. `/?home` still lands here
  // too for old links.
  const params = new URLSearchParams(window.location.search);
  if (!params.has('room') && !params.has('obs') && !params.has('studio')) {
    return <LandingPage />;
  }
  return (
    <OBSProvider>
      <OverlayLayout />
    </OBSProvider>
  );
}

export default App;
