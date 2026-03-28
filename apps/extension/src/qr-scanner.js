// Camera permission setup logic for dedicated page
(function() {
  'use strict';
  
  let stream = null;
  let statusDiv = null;
  let allowButton = null;
  let successOverlay = null;

  // Helper functions to get elements dynamically
  function getStatusDiv() {
    return statusDiv || document.getElementById('status');
  }

  function getAllowButton() {
    return allowButton || document.getElementById('allowCamera');
  }

  function getSuccessOverlay() {
    return successOverlay || document.getElementById('success-overlay');
  }

  // Check mode - this page is now ONLY for permission setup
  const urlParams = new URLSearchParams(window.location.search);
  const permissionMode = urlParams.get('mode') === 'permission';

  function showStatus(message, type = 'info') {
    const el = getStatusDiv();
    if (!el) {
      console.error('Status div not found');
      return;
    }
    el.textContent = message;
    el.className = `status ${type}`;
    el.style.display = 'block';
  }

  function showSuccess(message) {
    const overlay = getSuccessOverlay();
    if (!overlay) {
      console.error('Success overlay not found');
      return;
    }
    const messageDiv = document.getElementById('success-message');
    if (messageDiv) {
      messageDiv.textContent = message;
    }
    overlay.classList.add('show');
  }

  // Permission setup functions
  async function setupCameraPermissions() {
    const btn = getAllowButton();
    if (!btn) {
      console.error('Allow camera button not found');
      showStatus('Error: Button not found. Please refresh the page.', 'error');
      return;
    }
    
    try {
      showStatus('Requesting camera access...', 'info');
      btn.disabled = true;
      btn.textContent = 'Requesting...';

      console.log('Requesting camera permission...');
      console.log('navigator.mediaDevices available:', !!navigator.mediaDevices);
      console.log('getUserMedia available:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const errorMsg = 'Camera API not available in this browser. This page must be opened in a secure context (HTTPS or chrome-extension://).';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      // Check if we're in a secure context
      if (window.isSecureContext === false) {
        const errorMsg = 'Not in a secure context. Camera access requires HTTPS or chrome-extension:// protocol.';
        console.error(errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Calling getUserMedia with constraints:', { video: { facingMode: 'environment' } });
      
      // Request camera access - use simpler constraints for better compatibility
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment'
        }
      });
      
      console.log('getUserMedia resolved successfully, stream obtained:', !!stream);

      console.log('Camera access granted');

      // Immediately stop the stream - we just needed permission
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }

      // Store permission granted flag
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          'camera_permission_granted': true,
          'camera_permission_timestamp': Date.now()
        }, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to store camera permission:', chrome.runtime.lastError);
            showStatus('Failed to save permission settings', 'error');
            const btnEl = getAllowButton();
            if (btnEl) {
              btnEl.disabled = false;
              btnEl.textContent = 'Allow Camera Access';
            }
            return;
          }
          console.log('Camera permission stored successfully');
          onPermissionGranted();
        });
      } else {
        console.log('No storage API available, but camera access granted');
        onPermissionGranted();
      }
    } catch (error) {
      console.error('Camera permission error:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let message = 'Camera access denied or failed. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        message = 'Camera permission was denied. Please check your browser settings and allow camera access for this extension, then try again.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        message = 'No camera found on this device. Please connect a camera and try again.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        message = 'Camera is already in use by another application. Please close other apps using the camera and try again.';
      } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
        // Try again with simpler constraints
        message = 'Camera constraints not supported. Trying with basic settings...';
        showStatus(message, 'info');
        
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log('Camera access granted with basic constraints');
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
          onPermissionGranted();
          return;
        } catch (retryError) {
          message = 'Camera access failed. Please check your browser permissions.';
          console.error('Retry also failed:', retryError);
        }
      } else {
        message += error.message || 'Unknown error occurred.';
      }
      
      showStatus(message, 'error');

      // Re-enable the button
      const btnEl = getAllowButton();
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = 'Allow Camera Access';
      }
    }
  }

  function onPermissionGranted() {
    console.log('Permission setup complete - storing permission and closing tab');

    // Show success message
    showSuccess('Camera access granted!');

    // Store permission and close the tab
    setTimeout(() => {
      // Store permission flag in storage (this is accessible from the extension)
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.set({
          'camera_permission_granted': true,
          'camera_permission_timestamp': Date.now()
        }).then(() => {
          console.log('Camera permission stored, closing tab');
          window.close();
        }).catch((error) => {
          console.error('Failed to store camera permission:', error);
          // Still close the tab even if storage fails
          window.close();
        });
      } else {
        window.close();
      }
    }, 2000);
  }

  // Initialize when DOM is ready
  function init() {
    // Get elements
    statusDiv = document.getElementById('status');
    allowButton = document.getElementById('allowCamera');
    successOverlay = document.getElementById('success-overlay');

    // This page is now ONLY for permission setup
    if (!permissionMode) {
      console.error('Invalid mode - this page is only for camera permission setup');
      if (statusDiv) {
        statusDiv.textContent = 'Error: Invalid page mode';
        statusDiv.className = 'status error';
        statusDiv.style.display = 'block';
      }
      return;
    }

    // Event listeners
    if (allowButton) {
      allowButton.addEventListener('click', setupCameraPermissions);
      console.log('Camera permission button event listener attached');
    } else {
      console.error('Allow camera button not found!');
    }

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
    });
  }

  // Wait for DOM to be ready before initializing
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM already ready
    init();
  }
})();
