import OBSWebSocket from 'obs-websocket-js';
import { createContext, useContext, useEffect, useState } from 'react';

const OBSContext = createContext(null);

export const useOBS = () => useContext(OBSContext);

export const OBSProvider = ({ children }) => {
    const [obs] = useState(new OBSWebSocket());
    const [isConnected, setIsConnected] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const connectOBS = async () => {
            try {
                // Defaults: localhost:4455, no password (or empty)
                // You might need to change this if your OBS has a password
                await obs.connect('ws://localhost:4455', '');
                setIsConnected(true);
                console.log('Connected to OBS');

                // Check initial recording state
                const status = await obs.call('GetRecordStatus');
                setIsRecording(status.outputActive);
            } catch (err) {
                console.error('Failed to connect to OBS:', err);
                setError(err);
                setIsConnected(false);
            }
        };

        connectOBS();

        // Event listeners
        obs.on('RecordStateChanged', (data) => {
            setIsRecording(data.outputActive);
        });

        obs.on('ConnectionClosed', () => {
            setIsConnected(false);
            console.log('OBS Connection Closed');
        });

        return () => {
            obs.disconnect();
        };
    }, [obs]);

    return (
        <OBSContext.Provider value={{ obs, isConnected, isRecording, error }}>
            {children}
        </OBSContext.Provider>
    );
};
