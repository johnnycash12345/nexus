



import React, { useState, useRef, useEffect } from 'react';
// FIX: Import `Variants` type from framer-motion to correctly type animation variants.
import { motion, AnimatePresence, type Variants } from 'framer-motion';

interface CameraViewProps {
  onClose: () => void;
  onSend: (imageData: string, prompt: string) => void;
}

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { type: 'spring', stiffness: 120, damping: 15 }
  },
};

export const CameraView: React.FC<CameraViewProps> = ({ onClose, onSend }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setError('A API de mídia não é suportada neste navegador.');
          return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = devices.filter(device => device.kind === 'videoinput');
        if (videoInputDevices.length === 0) {
          setError('Nenhuma câmera encontrada. Verifique se o dispositivo está conectado e habilitado.');
          return;
        }

        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        console.error("Error accessing camera:", err);
        let errorMessage = 'Ocorreu um erro desconhecido ao acessar a câmera.';
        if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            errorMessage = 'Nenhuma câmera foi encontrada. Verifique se está conectada e habilitada.';
        } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorMessage = 'Acesso à câmera negado. Por favor, habilite a permissão nas configurações do seu navegador.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            errorMessage = 'Sua câmera já está em uso por outro aplicativo.';
        }
        setError(errorMessage);
      }
    };
    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      setIsCapturing(true);
      setTimeout(() => setIsCapturing(false), 300);

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
    <motion.div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-4" 
      onClick={onClose}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="hidden"
      transition={{ duration: 0.3 }}
    >
      <motion.div 
        className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-lg flex flex-col text-white relative" 
        onClick={e => e.stopPropagation()}
        variants={panelVariants}
      >
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">Visão do Nexus</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        
        <main className="p-4 flex-grow flex flex-col items-center justify-center">
          {error && <div className="w-full bg-red-900/50 border border-red-500 text-red-300 p-3 rounded-md mb-4 text-center">{error}</div>}
          <div className="w-full aspect-video bg-black rounded-md overflow-hidden mb-4 relative">
             <AnimatePresence>
                {isCapturing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-white z-10"
                    />
                )}
            </AnimatePresence>
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

        <footer className="flex-shrink-0 p-4 border-t border-gray-700/50 flex justify-center gap-4">
          {capturedImage ? (
              <>
                <button onClick={handleRetake} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors font-medium">Tirar Outra</button>
                <button onClick={handleSend} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors font-medium">Enviar para Nexus</button>
              </>
          ) : (
             <button onClick={handleCapture} disabled={!stream || !!error} className="w-20 h-20 rounded-full bg-white/20 border-4 border-white flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed transition-transform duration-200 active:scale-90">
                <div className="w-16 h-16 rounded-full bg-red-600 group-hover:bg-red-500 transition-colors"></div>
            </button>
          )}
        </footer>
      </motion.div>
    </motion.div>
  );
};