import { useEffect, useRef, useCallback, useState } from "react";
import type { IScannerControls } from "@zxing/browser";

interface UseBarcodeScanner {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isScanning: boolean;
  hasCamera: boolean;
  error: string | null;
  startScanner: () => Promise<void>;
  stopScanner: () => void;
}

export function useBarcodeScanner(
  onDetected: (code: string) => void,
  debounceMs = 1000
): UseBarcodeScanner {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const [isScanning, setIsScanning] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      if (code === lastCodeRef.current && now - lastTimeRef.current < debounceMs) {
        return;
      }
      lastCodeRef.current = code;
      lastTimeRef.current = now;
      onDetectedRef.current(code);
    },
    [debounceMs]
  );

  const stopScanner = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (zxingControlsRef.current) {
      zxingControlsRef.current.stop();
      zxingControlsRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  const startWithBarcodeDetector = useCallback(
    async (stream: MediaStream) => {
      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      const formats: BarcodeFormat[] = [
        "ean_8", "ean_13", "code_128", "code_39",
        "code_93", "qr_code", "upc_a", "upc_e", "itf",
      ];
      detectorRef.current = new BarcodeDetector({ formats });

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const barcodes = await detectorRef.current!.detect(videoRef.current);
          if (barcodes.length > 0 && barcodes[0]!.rawValue) {
            handleCode(barcodes[0].rawValue);
          }
        } catch {
          // Detection error — continue
        }
        rafRef.current = requestAnimationFrame(scan);
      };

      rafRef.current = requestAnimationFrame(scan);
      setIsScanning(true);
    },
    [handleCode]
  );

  const startWithZXing = useCallback(
    async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const video = videoRef.current;
        if (!video) return;

        const reader = new BrowserMultiFormatReader();

        // ZXing manages the stream internally; we pass undefined to use default camera
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, _error) => {
            if (result) {
              handleCode(result.getText());
            }
          }
        );

        zxingControlsRef.current = controls;
        setIsScanning(true);
      } catch {
        setError("No se pudo iniciar el escáner. Use la entrada de texto para pistolas físicas.");
        setIsScanning(false);
      }
    },
    [handleCode]
  );

  const startScanner = useCallback(async () => {
    setError(null);

    if ("BarcodeDetector" in window) {
      // Native BarcodeDetector — get stream manually for full control
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        setHasCamera(true);
        await startWithBarcodeDetector(stream);
      } catch (err) {
        handleCameraError(err);
      }
    } else {
      // ZXing fallback — it manages its own stream
      try {
        // Check permission first
        await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCamera(true);
        await startWithZXing();
      } catch (err) {
        handleCameraError(err);
      }
    }
  }, [startWithBarcodeDetector, startWithZXing]);

  function handleCameraError(err: unknown) {
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      setError("Permiso de cámara denegado. Use la entrada de texto para pistolas físicas.");
    } else if (err instanceof DOMException && err.name === "NotFoundError") {
      setError("No se encontró cámara. Use la entrada de texto para pistolas físicas.");
    } else {
      setError("No se pudo acceder a la cámara.");
    }
    setHasCamera(false);
  }

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  return { videoRef, isScanning, hasCamera, error, startScanner, stopScanner };
}

// BarcodeDetector global types for TypeScript
declare global {
  class BarcodeDetector {
    constructor(options?: { formats?: BarcodeFormat[] });
    detect(
      image: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap
    ): Promise<DetectedBarcode[]>;
    static getSupportedFormats(): Promise<BarcodeFormat[]>;
  }

  interface DetectedBarcode {
    rawValue: string;
    format: BarcodeFormat;
    boundingBox: DOMRectReadOnly;
    cornerPoints: { x: number; y: number }[];
  }

  type BarcodeFormat =
    | "aztec" | "code_128" | "code_39" | "code_93" | "codabar"
    | "data_matrix" | "ean_13" | "ean_8" | "itf" | "pdf417"
    | "qr_code" | "unknown" | "upc_a" | "upc_e";
}
