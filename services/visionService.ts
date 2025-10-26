// This service uses TensorFlow.js and the COCO-SSD model, which are loaded
// via script tags in index.html. We use `declare` to inform TypeScript
// about these globally available variables without needing to import them.
declare const cocoSsd: {
    load: () => Promise<any>; // The loaded model has a `detect` method.
};

let model: any = null;
let animationFrameId: number | null = null;

const init = async (): Promise<void> => {
    if (model) return;
    try {
        model = await cocoSsd.load();
        console.log('COCO-SSD model loaded successfully.');
    } catch (err) {
        console.error("Failed to load COCO-SSD model:", err);
    }
};

const start = (
    videoElement: HTMLVideoElement,
    onDetections: (detections: string[]) => void
): void => {
    if (!model) {
        console.warn("Vision model not initialized. Cannot start detection.");
        return;
    }

    const detectFrame = async () => {
        // Ensure the video is ready to be processed
        if (videoElement.readyState >= 3) { // HAVE_FUTURE_DATA or HAVE_ENOUGH_DATA
            const predictions = await model.detect(videoElement);
            // Extract unique class labels from the predictions
            const labels = [...new Set(predictions.map((p: any) => p.class))];
            if (labels.length > 0) {
                onDetections(labels as string[]);
            }
        }
        // Continue the loop
        animationFrameId = requestAnimationFrame(detectFrame);
    };

    detectFrame();
};

const stop = (): void => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
};

export const visionService = {
    init,
    start,
    stop,
};
