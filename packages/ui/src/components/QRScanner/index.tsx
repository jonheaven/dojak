import { BottomModal, Button, Card, Column, Row, Text } from '@dojak/ui/components';
import { CameraOutlined } from '@ant-design/icons';
import jsQR from 'jsqr';
import React, { useEffect, useRef, useState } from 'react';


interface QRScannerProps {
  onScan: (data: string) => void;
  onError?: (error: string) => void;
  title?: string;
  buttonText?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  onScan,
  onError,
  title = "Scan QR Code",
  buttonText = "Start Camera"
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const isSwitchingCameraRef = useRef(false);

  const [isScanning, setIsScanning] = useState(false);
  const isScanningRef = useRef(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [cameraDevices, setCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isEnumeratingDevices, setIsEnumeratingDevices] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const startCamera = async () => {
    try {
      // Clean up any existing state first
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      setErrorMessage('');
      setIsScanning(false); // Reset scanning state
      isScanningRef.current = false;
      console.log('🔍 QRScanner: Starting camera...');
      console.log('🔍 QRScanner: Selected camera:', cameraDevices[currentCameraIndex]?.label || `Camera ${currentCameraIndex + 1}`);

      // First check if we have permission
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('🔍 QRScanner: Camera permission status:', permissionStatus.state);
      } catch (permError) {
        console.log('🔍 QRScanner: Permission query failed:', permError);
      }

      // Request camera access with selected device or back camera preference
      console.log('🔍 QRScanner: Calling getUserMedia...');

      let constraints: MediaStreamConstraints;
      let stream;

      // Always try to use the selected camera device if available
      if (cameraDevices.length > 0 && cameraDevices[currentCameraIndex]) {
        console.log('🔍 Using camera device:', cameraDevices[currentCameraIndex].label || `Camera ${currentCameraIndex + 1}`);

        // Use the same logic as switchToCamera
        constraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            deviceId: { exact: cameraDevices[currentCameraIndex].deviceId }
          }
        };

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (specificError) {
          console.log('📹 Specific constraints failed, trying basic device-only constraints');
          // Fallback to basic constraints without specific resolution
          constraints = {
            video: {
              deviceId: { exact: cameraDevices[currentCameraIndex].deviceId }
            }
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        }
      } else {
        // Fallback to basic facing mode preference
        constraints = {
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'environment' // Prefer back camera
          } as any
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      }

      console.log('✅ QRScanner: Camera access granted, stream:', stream);

      // Get the actual device ID from the stream to verify it matches
      const videoTrack = stream.getVideoTracks()[0];
      const actualDeviceId = videoTrack?.getSettings().deviceId;
      if (actualDeviceId && cameraDevices.length > 0) {
        const foundIndex = cameraDevices.findIndex(device => device.deviceId === actualDeviceId);
        if (foundIndex !== -1) {
          console.log('📹 Found matching device at index:', foundIndex, 'for device:', cameraDevices[foundIndex]?.label);
          setCurrentCameraIndex(foundIndex);
        }
      }

      if (videoRef.current) {
        // Clear any existing srcObject first
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);

        // Start scanning immediately when video is ready
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 Video metadata loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          console.log('📹 Video element size:', videoRef.current.offsetWidth, 'x', videoRef.current.offsetHeight);
          console.log('📹 Video readyState:', videoRef.current.readyState);

          // Check if video dimensions are reasonable for QR scanning
          if (videoRef.current.videoWidth < 320 || videoRef.current.videoHeight < 240) {
            console.warn('⚠️ Video resolution too low for reliable QR scanning:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          }

          console.log('📹 Video metadata loaded, attempting to play...');
          videoRef.current.play().then(() => {
            console.log('▶️ Video playing, readyState:', videoRef.current.readyState);
            console.log('▶️ Starting scan loop immediately');
            setIsScanning(true); // Set scanning state right before starting scan loop
            isScanningRef.current = true;
            scanLoop();
          }).catch((playError) => {
            console.error('❌ Video play failed:', playError);
          });
        };
      }
    } catch (error: any) {
      console.error('Camera access error:', error);
      setHasPermission(false);
      setIsInitializing(false);

      let errorMsg = 'Camera access denied or unavailable.';
      if (error.name === 'NotAllowedError') {
        console.log('Camera permission denied in popup - opening setup tab');
        // Automatically open the permission setup tab
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const setupUrl = chrome.runtime.getURL('qr-scanner.html?mode=permission');
          chrome.tabs.create({ url: setupUrl });
        } else {
          window.open('/qr-scanner.html?mode=permission', '_blank');
        }
        errorMsg = 'Opening camera setup page...';
      } else if (error.name === 'NotFoundError') {
        errorMsg = 'No camera found on this device.';
      } else if (error.name === 'NotReadableError') {
        errorMsg = 'Camera is already in use by another application.';
      } else if (error.name === 'AbortError') {
        errorMsg = 'Camera access was interrupted.';
      }

      setErrorMessage(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    console.log('🔍 QRScanner: Component mounted - starting camera automatically');

    // Enumerate available camera devices first
    enumerateCameraDevices().then(() => {
      // Auto-start camera immediately after device enumeration
      startCamera();
    });

    return () => {
      console.log('🔍 QRScanner: Component unmounting');
      stopScanning();
    };
  }, []);


  const scanLoop = () => {
    if (!isScanningRef.current || !videoRef.current || !canvasRef.current) {
      console.log('🔍 scanLoop: exiting early - isScanning:', isScanningRef.current, 'video:', !!videoRef.current, 'canvas:', !!canvasRef.current);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data for QR code detection
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Try to decode QR code
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        console.log('✅ QR Code detected:', code.data);
        onScan(code.data);
        stopScanning();
        return;
      } else {
        // Log occasionally to show scanning is active
        if (Math.random() < 0.01) { // ~1% of frames
          console.log(`🔍 Scanning active: ${imageData.width}x${imageData.height} frame processed`);
        }
      }
    } else {
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        console.log(`🔍 Video not ready for scanning, readyState: ${video.readyState}`);
      }
    }

    // Continue scanning
    animationRef.current = requestAnimationFrame(scanLoop);
  };

  const stopScanning = () => {
    console.log('🛑 Stopping QR scanning...');
    setIsScanning(false);
    isScanningRef.current = false;

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    console.log('✅ QR scanning stopped');
  };


  const enumerateCameraDevices = async () => {
    try {
      setIsEnumeratingDevices(true);
      console.log('🔍 Enumerating camera devices...');

      // Request permission first to access device labels
      await navigator.mediaDevices.getUserMedia({ video: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      console.log('🔍 Found camera devices:', videoDevices);
      setCameraDevices(videoDevices);

      // Select best camera by default (prefer back camera, then highest quality)
      if (videoDevices.length > 0) {
        let bestIndex = 0;

        // Look for back/environment camera first
        const backCameraIndex = videoDevices.findIndex(device =>
          device.label.toLowerCase().includes('back') ||
          device.label.toLowerCase().includes('rear') ||
          device.label.toLowerCase().includes('environment')
        );

        if (backCameraIndex !== -1) {
          bestIndex = backCameraIndex;
          console.log('🔍 Selected back camera:', videoDevices[bestIndex].label);
        } else {
          // If no back camera found, look for high-quality cameras
          const highQualityIndex = videoDevices.findIndex(device =>
            device.label.toLowerCase().includes('4k') ||
            device.label.toLowerCase().includes('uhd') ||
            device.label.toLowerCase().includes('1080') ||
            device.label.toLowerCase().includes('logitech') // Prioritize known good cameras
          );

          if (highQualityIndex !== -1) {
            bestIndex = highQualityIndex;
            console.log('🔍 Selected high-quality camera:', videoDevices[bestIndex].label);
          }
        }

        setCurrentCameraIndex(bestIndex);
        console.log('🔍 Default camera set to index', bestIndex, ':', videoDevices[bestIndex]?.label);
      }

      return videoDevices;
    } catch (error) {
      console.error('❌ Error enumerating camera devices:', error);
      setCameraDevices([]);
      return [];
    } finally {
      setIsEnumeratingDevices(false);
    }
  };

  const switchCamera = (direction: 'prev' | 'next') => {
    if (cameraDevices.length <= 1) {
      console.log('🔍 Only one camera available, cannot switch');
      return;
    }

    // Prevent multiple simultaneous switches
    if (isSwitchingCameraRef.current) {
      console.log('🔍 Camera switch already in progress, ignoring request');
      return;
    }

    const newIndex = direction === 'next'
      ? (currentCameraIndex + 1) % cameraDevices.length
      : (currentCameraIndex - 1 + cameraDevices.length) % cameraDevices.length;

    console.log(`🔍 Switching camera from ${currentCameraIndex} to ${newIndex} (${direction})`);

    // Switch camera on the fly without stopping scanning
    // Don't update currentCameraIndex yet - wait for switchToCamera to complete
    if (isScanning && streamRef.current) {
      switchToCamera(newIndex);
    } else {
      // If not scanning, just update the index
      setCurrentCameraIndex(newIndex);
    }
  };

  const switchToCamera = async (deviceIndex: number) => {
    // Prevent multiple simultaneous switches
    if (isSwitchingCameraRef.current) {
      console.log('🔍 Camera switch already in progress, ignoring request');
      return;
    }

    isSwitchingCameraRef.current = true;

    try {
      console.log(`🔍 Switching to camera ${deviceIndex}:`, cameraDevices[deviceIndex]?.label);

      // Stop current stream and scanning loop temporarily
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Get new camera stream - try specific constraints first, fallback to basic if needed
      let constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          deviceId: { exact: cameraDevices[deviceIndex].deviceId }
        }
      };

      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (specificError) {
        console.log('📹 Specific constraints failed, trying basic constraints for camera:', cameraDevices[deviceIndex]?.label);
        // Fallback to basic constraints without specific resolution
        constraints = {
          video: {
            deviceId: { exact: cameraDevices[deviceIndex].deviceId }
          }
        };
        newStream = await navigator.mediaDevices.getUserMedia(constraints);
      }
      console.log('✅ Switched to new camera stream');

      // Get the actual device ID from the stream to verify it matches
      const videoTrack = newStream.getVideoTracks()[0];
      const actualDeviceId = videoTrack.getSettings().deviceId;
      console.log('📹 Actual device ID from stream:', actualDeviceId);
      console.log('📹 Expected device ID:', cameraDevices[deviceIndex]?.deviceId);

      // Find the correct index based on the actual device ID (in case it doesn't match)
      let actualIndex = deviceIndex;
      if (actualDeviceId) {
        const foundIndex = cameraDevices.findIndex(device => device.deviceId === actualDeviceId);
        if (foundIndex !== -1) {
          actualIndex = foundIndex;
          console.log('📹 Found matching device at index:', actualIndex);
        }
      }

      // Update video element with new stream
      if (videoRef.current) {
        // Clear any existing srcObject first
        videoRef.current.srcObject = null;
        videoRef.current.srcObject = newStream;
        streamRef.current = newStream;

        // Update the camera index state immediately after setting the stream
        // This ensures the label matches the stream we just set
        setCurrentCameraIndex(actualIndex);

        // Wait for video to be ready, then restart scanning
        videoRef.current.onloadedmetadata = () => {
          console.log('📹 New camera video loaded, dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
          videoRef.current.play().then(() => {
            console.log('▶️ Video playing, starting scan loop');
            // Start the scanning loop again
            scanLoop();
            // Clear the switching flag after successful switch
            isSwitchingCameraRef.current = false;
          }).catch(err => {
            console.error('❌ Error playing video:', err);
            isSwitchingCameraRef.current = false;
          });
        };
      }
    } catch (error) {
      console.error('❌ Error switching camera:', error);
      isSwitchingCameraRef.current = false;
      // Fallback to restart camera completely
      stopScanning();
      setTimeout(() => startCamera(), 500);
    }
  };

  const openDedicatedScanner = () => {
    // Open QR scanner in a dedicated tab where camera permissions work
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      const scannerUrl = chrome.runtime.getURL('qr-scanner.html');
      chrome.tabs.create({ url: scannerUrl });
    } else {
      // Fallback for development
      window.open('/qr-scanner.html', '_blank');
    }
  };

  return (
    <Column gap="md" itemsCenter>
      <Row itemsCenter justifyCenter gap="sm">
        <Text text={title} preset="sub" />
        <Button
          onClick={() => setShowInstructions(true)}
          preset="minimal"
          style={{
            minWidth: '24px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            padding: '0',
            backgroundColor: 'transparent',
            border: '1px solid var(--border-soft)',
            color: 'var(--text-secondary)'
          }}
          title="View Instructions"
        >
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>?</span>
        </Button>
      </Row>

      <Card
        style={{
          width: '320px',
          height: '320px',
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-tertiary)',
          border: isScanning ? '2px solid #E5A03A' : '2px dashed var(--border-soft)'
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isScanning ? 'block' : 'none'
          }}
        />

        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />

        {!isScanning && (
          <Column
            itemsCenter
            justifyCenter
            style={{
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          >
            <CameraOutlined style={{ fontSize: '48px', color: 'var(--text-muted)' }} />
            <Text
              text={isInitializing ? "Starting camera..." : "Camera not active"}
              preset="sub"
              style={{ color: 'var(--text-muted)', marginTop: '8px' }}
            />
          </Column>
        )}

        {isScanning && (
          <>
            {/* Camera switcher with arrows */}
            {cameraDevices.length > 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '20px',
                  zIndex: 10
                }}
              >
                <button
                  onClick={() => switchCamera('prev')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Previous camera"
                >
                  ‹
                </button>
                <span
                  style={{
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: '12px',
                    whiteSpace: 'nowrap',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={cameraDevices[currentCameraIndex]?.label || `Camera ${currentCameraIndex + 1}`}
                >
                  📷 {cameraDevices[currentCameraIndex]?.label?.split(' (')[0] || `Camera ${currentCameraIndex + 1}`}
                </span>
                <button
                  onClick={() => switchCamera('next')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Next camera"
                >
                  ›
                </button>
              </div>
            )}

            {/* Scanning guide box */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '200px',
                height: '200px',
                border: '2px solid #E5A03A',
                borderRadius: '8px',
                pointerEvents: 'none'
              }}
            />
            {/* Animated scanning line */}
            <div
              className="scanning-line"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent, #E5A03A, transparent)',
                boxShadow: '0 0 15px #E5A03A, 0 0 30px rgba(229, 160, 58, 0.3)',
                pointerEvents: 'none'
              }}
            />
          </>
        )}
      </Card>

      {errorMessage && (
        <Text
          text={errorMessage}
          preset="sub"
          textCenter
          style={{ color: 'var(--error-red)', maxWidth: '300px' }}
        />
      )}


        <Row gap="sm">
          {isInitializing ? (
            <Button
              preset="primary"
              text="Starting Camera..."
              disabled
              style={{ minWidth: '140px' }}
            >
              <CameraOutlined />
            </Button>
          ) : hasPermission === false ? (
            <Button
              onClick={openDedicatedScanner}
              preset="primary"
              text="Setup Camera"
              style={{ minWidth: '140px' }}
            >
              <CameraOutlined />
            </Button>
          ) : null}

        {hasPermission === false && (
          <Button
            onClick={openDedicatedScanner}
            preset="primary"
            text="Open Scanner Page"
            style={{ minWidth: '140px', marginTop: '8px' }}
          />
        )}

      </Row>

      {/* CSS for scanning animation */}
      <style>{`
        .scanning-line {
          animation: scanAnimation 2s ease-in-out infinite;
        }

        @keyframes scanAnimation {
          0% {
            top: 0;
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            top: calc(100% - 3px);
            opacity: 0;
          }
        }
      `}</style>

      {showInstructions && (
        <BottomModal onClose={() => setShowInstructions(false)}>
          <Column gap="md">
            <Text text="QR Scanner Instructions" preset="title" textCenter />
            <Text
              text="The QR scanner automatically detects and imports wallet information from QR codes. It supports seed phrases (12 or 24 words), WIF private keys, and hex private keys."
              preset="regular"
              style={{ lineHeight: '1.5' }}
            />
            <Text
              text="• Position any wallet QR code within the green guide box on the camera view"
              preset="regular"
              style={{ lineHeight: '1.5', color: 'var(--text-secondary)' }}
            />
            <Text
              text="• The scanner starts automatically when camera permissions are granted"
              preset="regular"
              style={{ lineHeight: '1.5', color: 'var(--text-secondary)' }}
            />
            <Text
              text="• Use the arrow buttons (‹ ›) in the top-right to switch between available cameras"
              preset="regular"
              style={{ lineHeight: '1.5', color: 'var(--text-secondary)' }}
            />
            <Text
              text="• If camera permissions are denied, use 'Setup Camera' to grant access"
              preset="regular"
              style={{ lineHeight: '1.5', color: 'var(--text-secondary)' }}
            />
            <Text
              text="• Camera permissions work best in fullscreen mode - use Settings → Expand View if needed"
              preset="regular"
              style={{ lineHeight: '1.5', color: 'var(--text-secondary)' }}
            />
          </Column>
        </BottomModal>
      )}

    </Column>
  );
};

export default QRScanner;
