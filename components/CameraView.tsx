import React, { useState, useRef, useEffect } from 'react';

interface CameraViewProps {
  onClose: () => void;
  onSend: (imageData: string, prompt: string) => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onClose, onSend }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError('Não foi possível acessar a câmera. Verifique as permissões.');
      }
    };
    startCamera();

    return () => {
      stream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
        stream?.getTracks().forEach(track => track.stop());
        setStream(null);
      }
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setError('');
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        console.error("Error restarting camera:", err);
        setError('Não foi possível reiniciar a câmera.');
      }
    };
    startCamera();
  };
  
  const handleSend = () => {
    if (capturedImage) {
        onSend(capturedImage, prompt);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4 animate-fade-in-fast">
        <style>{`
            @keyframes fade-in-fast {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-out forwards; }
        `}</style>
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg flex flex-col text-white relative" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Visão do Nexus</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        
        <main className="p-4 flex-grow flex flex-col items-center justify-center">
          {error && <p className="text-red-400 mb-4">{error}</p>}
          <div className="w-full aspect-video bg-black rounded-md overflow-hidden mb-4 relative">
            {capturedImage ? (
                <img src={capturedImage} alt="Captured" className="w-full h-full object-contain" />
            ) : (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-contain"></video>
            )}
            {!stream && !capturedImage && !error && <p className="absolute inset-0 flex items-center justify-center text-gray-400">Iniciando câmera...</p>}
          </div>
          <canvas ref={canvasRef} className="hidden"></canvas>

          {capturedImage && (
              <div className="w-full">
                  <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Adicione uma pergunta ou comando (opcional)..."
                    className="w-full bg-gray-700 rounded-full px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
              </div>
          )}
        </main>

        <footer className="flex-shrink-0 p-4 border-t border-gray-700/50 flex justify-end gap-4">
          {capturedImage ? (
              <>
                <button onClick={handleRetake} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Tirar Outra</button>
                <button onClick={handleSend} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors">Enviar para Nexus</button>
              </>
          ) : (
              <button onClick={handleCapture} disabled={!stream} className="px-6 py-3 bg-red-600 hover:bg-red-500 rounded-full transition-colors disabled:bg-gray-500 text-lg font-bold">Capturar</button>
          )}
        </footer>
      </div>
    </div>
  );
};