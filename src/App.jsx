import OverlayLayout from './components/OverlayLayout';
import { OBSProvider } from './context/OBSContext';

function App() {
  return (
    <OBSProvider>
      <OverlayLayout />
    </OBSProvider>
  );
}

export default App;
