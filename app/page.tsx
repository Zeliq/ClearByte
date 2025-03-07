"use client";

declare global {
  interface MediaTrackConstraints {
    focusMode?: ConstrainDOMString;
    pointsOfInterest?: { x: number; y: number }[];
  }
  interface MediaTrackCapabilities {
    focusMode?: string[];
  }
  interface MediaTrackConstraintSet {
    focusMode?: ConstrainDOMString;
    pointsOfInterest?: { x: number; y: number }[];
  }
}

import { useState, useRef, useEffect, useCallback } from "react";
import { RefreshCcw, Zap, Check, Image as ImageIcon, CameraOff, CheckCircle, XCircle, X, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import axios from "axios";
import Image from "next/image";

interface AnalysisResult {
  text?: string;
  classification?: Record<string, boolean>;
}

export default function CameraApp() {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">("user");
  const [flash, setFlash] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [expandedText, setExpandedText] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [focusPoint, setFocusPoint] = useState<{x: number; y: number} | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  const checkCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: cameraFacing,
          focusMode: { ideal: "continuous" }
        }
      });
      if (stream) {
        setCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      setCameraPermission(false);
    }
  }, [cameraFacing]);

  const handleVideoClick = (e: React.MouseEvent<HTMLVideoElement>) => {
    const video = videoRef.current;
    if (!video || !video.srcObject) return;
    const stream = video.srcObject as MediaStream;
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    const rect = video.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setFocusPoint({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setTimeout(() => setFocusPoint(null), 1000);
    try {
      const capabilities = track.getCapabilities();
      if (capabilities.focusMode && capabilities.focusMode.includes("manual")) {
        track.applyConstraints({
          advanced: [{ focusMode: "manual", pointsOfInterest: [{ x, y }] }
        ]}).catch(console.error);
      }
    } catch (error) {
      console.error("Error applying focus:", error);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMounted && !showInstructions) checkCameraPermission();
  }, [isMounted, showInstructions, checkCameraPermission]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: cameraFacing,
          focusMode: { ideal: "continuous" }
        }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      setCameraPermission(false);
    }
  }, [cameraFacing]);

  useEffect(() => {
    if (isMounted && cameraPermission && !showInstructions) {
      startCamera();
    }
  }, [cameraFacing, isMounted, cameraPermission, startCamera, showInstructions]);

  const captureImage = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedImage = new File([blob], "camera-capture.jpg", {
          type: "image/jpeg",
        });
        setImage(capturedImage);
        setImagePreview(URL.createObjectURL(blob));
      }
    }, "image/jpeg");
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const submitImage = async () => {
    if (!image) return;
    setLoading(true);
    setResultVisible(false);
    setNetworkError(false);
    const formData = new FormData();
    formData.append("file", image);
    try {
      const response = await axios.post(
        "https://clearbyte-backend-render.onrender.com/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          timeout: 30000,
        }
      );
      setResult(response.data as AnalysisResult);
      setResultVisible(true);
    } catch (error) {
      console.error("Upload failed", error);
      setNetworkError(true);
      let errorMessage = "An error occurred while processing your request";
      if (axios.isAxiosError(error)) {
        if (error.response) {
          errorMessage = `Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
        } else if (error.request) {
          errorMessage = "No response from server. Please check your internet connection";
        } else {
          errorMessage = `Request error: ${error.message}`;
        }
      }
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-gray-910">
      {networkError && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center z-50">
          <span className="block sm:inline">Network error occurred. Please check your connection.</span>
          <button 
            onClick={() => setNetworkError(false)}
            className="ml-4 text-red-700 hover:text-red-900"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showInstructions && (
        <div 
          className="absolute inset-0 flex flex-col items-center justify-center z-30"
          style={{
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(10px)"
          }}
        >
          <div className="max-w-md p-6 bg-gray-900 rounded-xl border border-gray-700 mx-4">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white mb-4">How to Use</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-100 mb-1">Instructions</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Take a clear picture of the ingredients list using the camera, 
                      or upload an existing image from your device. Submit the image 
                      to get the classification results.
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-1">
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-100 mb-1">Disclaimer</h3>
                    <p className="text-gray-400 leading-relaxed">
                      Accuracy may vary. This system cannot guarantee detection of 
                      cross-contamination or verify slaughter methods. Results 
                      should be verified independently.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowInstructions(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
            >
              <span>Got It</span>
              <Check className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      <div 
        className={`relative overflow-hidden bg-[#111111] ${isMobile ? 'w-full h-screen' : 'w-[375px] h-[750px]'} shadow-2xl`}
        style={{
          borderRadius: isMobile ? '0' : '32px',
          boxShadow: isMobile ? 'none' : '0 0 40px rgba(0, 0, 0, 0.6), 0 0 100px rgba(0, 0, 0, 0.4)'
        }}
      >
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          {cameraPermission && (
            <>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                className="absolute w-full h-full object-cover cursor-pointer"
                onClick={handleVideoClick}
              />
              {focusPoint && (
                <div
                  className="absolute w-20 h-20 border-2 border-white rounded-full opacity-70"
                  style={{
                    left: focusPoint.x - 40,
                    top: focusPoint.y - 40,
                    animation: 'pulse 1s ease-out forwards',
                    pointerEvents: 'none'
                  }}
                />
              )}
            </>
          )}
          {cameraPermission === false && (
            <div 
              className="absolute inset-0 flex flex-col items-center justify-center"
              style={{
                background: "rgba(0, 0, 0, 0.7)",
                backdropFilter: "blur(10px)"
              }}
            >
              <CameraOff className="w-16 h-16 text-white opacity-60 mb-4" />
              <p className="text-white text-lg font-medium">Camera access denied</p>
              <p className="text-gray-400 mt-2 max-w-xs text-center">
                Please allow camera access in your browser settings to use this feature
              </p>
              <button 
                onClick={checkCameraPermission}
                className="mt-6 bg-white text-black px-6 py-2 rounded-lg"
              >
                Try Again
              </button>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div 
          className="absolute top-0 left-0 right-0 h-24 flex items-center justify-center"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)",
            zIndex: 10
          }}
        >
          <Image 
            src="/ClearByte.png" 
            alt="ClearByte Logo"
            width={100}
            height={40}
            className="h-6.5"
            unoptimized
          />
        </div>

        {cameraPermission && (
          <div className="absolute top-6 flex justify-between w-full px-6 z-10">
            <button
              onClick={() => setFlash(!flash)}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
              className="p-3 rounded-full shadow-md"
            >
              <Zap className={`w-7 h-7 ${flash ? "text-yellow-500" : "text-white"}`} />
            </button>

            <button
              onClick={() => setCameraFacing(cameraFacing === "user" ? "environment" : "user")}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
              className="p-3 rounded-full shadow-md"
            >
              <RefreshCcw className="w-7 h-7 text-white" />
            </button>
          </div>
        )}

        {cameraPermission && (
          <div
            className="absolute bottom-6 flex items-center justify-between w-[340px] h-[100px] p-4 rounded-full shadow-lg mx-auto left-0 right-0 z-10"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <div className="relative w-16 h-16 rounded-full flex items-center justify-center bg-white bg-opacity-30 shadow-md overflow-hidden cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              {imagePreview ? (
                <Image 
                  src={imagePreview}
                  alt="Captured preview"
                  width={64}
                  height={64}
                  className="w-full h-full object-cover rounded-full"
                  unoptimized
                />
              ) : (
                <ImageIcon className="w-8 h-8 text-gray-400" />
              )}
            </div>

            <button onClick={captureImage} className="relative flex items-center justify-center w-18 h-18 rounded-full border-[4px] border-white bg-white shadow-lg">
              <div className="absolute w-[99%] h-[99%] bg-white rounded-full border-[2px] border-gray-400"></div>
            </button>

            <button
              onClick={submitImage}
              style={{
                background: "rgba(255, 255, 255, 0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
              }}
              className="p-3 rounded-full shadow-md relative"
              disabled={loading || !image}
            >
              {loading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                </div>
              ) : (
                <Check className={`w-8 h-8 ${loading ? "text-gray-400" : "text-white"}`} />
              )}
            </button>
          </div>
        )}

        {resultVisible && (
          <div
            className="absolute bottom-0 w-full bg-white/80 backdrop-blur-lg rounded-t-3xl p-6 shadow-lg transition-transform duration-300 transform translate-y-0 z-20"
            style={{ transform: resultVisible ? 'translateY(0)' : 'translateY(100%)' }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Analysis Results</h2>
              <button 
                onClick={() => setResultVisible(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              {result?.text && (
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-gray-600 text-sm mb-2">Extracted Text</p>
                      <p className="text-gray-800 whitespace-pre-wrap">
                        {expandedText 
                          ? result.text 
                          : (result.text.length > 150
                            ? `${result.text.substring(0, 150).replace(/\r?\n/g, ' ')}...`
                            : result.text)}
                      </p>
                    </div>
                    {result.text.length > 150 && (
                      <button 
                        onClick={() => setExpandedText(!expandedText)}
                        className="ml-4 text-blue-600 hover:text-blue-700"
                      >
                        {expandedText ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {result?.classification && (
                <div className="bg-white p-4 rounded-xl shadow-sm">
                  <p className="text-gray-600 text-sm mb-3">Food Classification</p>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(result.classification).map(([className, isValid]) => (
                      <div 
                        key={className}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <span className="font-medium text-gray-700 capitalize">
                          {className}
                        </span>
                        <div className="flex items-center space-x-2">
                          {isValid ? (
                            <CheckCircle className="w-5 h-5 text-green-500" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setResultVisible(false)}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
            >
              Close Results
            </button>
          </div>
        )}
      </div>
      
      {!isMobile && (
        <div className="fixed bottom-6 text-gray-400 text-center max-w-md px-4">
          <p>Use this camera interface to capture and analyze images</p>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 0.4; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}