# Picture-in-Picture (PiP) Testing Guide

This document provides guidance on testing the Picture-in-Picture feature in the Meet Conference application.

## Table of Contents

1. [Manual Testing](#manual-testing)
2. [Browser Compatibility](#browser-compatibility)
3. [Test Scenarios](#test-scenarios)
4. [Automated Tests](#automated-tests)
5. [Troubleshooting](#troubleshooting)

---

## Manual Testing

### Prerequisites

- A supported browser (Chrome 116+, Edge 116+, or Opera 102+)
- A meeting room with at least 2 participants
- Camera and microphone permissions granted

### How to Manually Test PiP

#### Basic PiP Functionality

1. **Join a meeting**
   - Navigate to the meeting URL
   - Complete pre-join checks (camera, microphone)
   - Click "Join Meeting"

2. **Open PiP Window**
   - Locate the Picture-in-Picture button in the Control Bar
   - Click the PiP button (icon: `PictureInPicture2`)
   - A small floating window should appear

3. **Verify PiP Window Content**
   - The PiP window should show participant video(s)
   - Control buttons should be visible at the bottom
   - The main browser tab can be minimized/navigated away

4. **Test PiP Controls**
   - Click the microphone button to mute/unmute
   - Click the camera button to enable/disable video
   - Click the screen share button (if permitted)
   - Click "Return to Tab" to focus the main meeting
   - Click "Leave" to end the call

#### Role-Based Testing

**As Host/Moderator:**
1. All participants with camera enabled should be visible
2. Active speakers should be highlighted
3. Screen shares should take priority over video grid

**As Attendee:**
1. Only moderators and active speakers should be visible
2. Self-view should always be included
3. Screen shares should be visible when shared by moderators

---

## Browser Compatibility

### Supported Browsers

| Browser | Version | Support Level |
|---------|---------|---------------|
| Chrome  | 116+    | ✅ Full support |
| Edge    | 116+    | ✅ Full support |
| Opera   | 102+    | ✅ Full support |
| Firefox | -       | ❌ Not supported (Document PiP API not available) |
| Safari  | -       | ❌ Not supported (uses different PiP API) |

### Feature Detection

The application checks for Document PiP support using:

```javascript
if ('documentPictureInPicture' in window) {
  // Document PiP is supported
} else {
  // Show fallback message
}
```

### Known Limitations

1. **Firefox**: Does not support the Document Picture-in-Picture API
   - Fallback: Show notification that PiP is not available

2. **Safari**: Uses a different Picture-in-Picture API
   - Safari's PiP only works with video elements, not full documents
   - Fallback: Consider using video element PiP for single video

3. **Mobile Browsers**: Document PiP is generally not supported
   - Fallback: Use native mobile PiP if available

---

## Test Scenarios

### Scenario 1: Single Participant

**Steps:**
1. Join meeting as the only participant
2. Open PiP window
3. Verify self-view is shown

**Expected Result:**
- PiP window shows your own video
- Name displays as "You"
- All controls are functional

### Scenario 2: Multiple Participants (Moderator View)

**Steps:**
1. Join meeting as host/moderator
2. Have 2-3 other participants join
3. Open PiP window
4. Verify all participants are visible

**Expected Result:**
- All participants with cameras enabled are shown
- Grid layout adjusts based on count
- Active speaker is highlighted

### Scenario 3: Multiple Participants (Attendee View)

**Steps:**
1. Join meeting as regular attendee
2. Have a host and other attendees join
3. Open PiP window
4. Verify only moderators and active speakers are visible

**Expected Result:**
- Only moderators are shown (not other attendees)
- Self-view is included
- Active speakers appear when speaking

### Scenario 4: Screen Share in PiP

**Steps:**
1. Have a participant start screen sharing
2. Open PiP window
3. Verify screen share is shown

**Expected Result:**
- Screen share takes full PiP window
- Presenter name is shown
- Video grid returns when screen share ends

### Scenario 5: PiP Window Controls

**Steps:**
1. Open PiP window
2. Test each control button:
   - Mute/unmute microphone
   - Enable/disable camera
   - Start/stop screen share
   - Return to main tab
   - Leave meeting

**Expected Result:**
- Each button performs its action correctly
- State changes are reflected in both windows
- Leave meeting closes PiP and returns to main tab

### Scenario 6: Network Issues

**Steps:**
1. Open PiP window
2. Simulate network issues (dev tools offline mode)
3. Verify graceful degradation

**Expected Result:**
- PiP window remains open
- Reconnection attempts are made
- Error messages are shown if needed

### Scenario 7: Window Focus

**Steps:**
1. Open PiP window
2. Navigate to another browser tab
3. Click "Return to Tab" button

**Expected Result:**
- Main meeting tab receives focus
- PiP window remains open

### Scenario 8: Closing PiP

**Steps:**
1. Open PiP window
2. Close PiP using the window's close button (X)
3. Verify state is updated

**Expected Result:**
- PiP window closes
- `isPiPOpen` state is set to false
- Control bar button state updates

---

## Automated Tests

### Test File Locations

```
src/components/pip/__tests__/
├── PiPContainer.test.tsx    # Container and LiveKit integration tests
├── PiPVideoGrid.test.tsx    # Grid layout and participant filtering tests
└── integration.test.tsx     # Store and ControlBar integration tests
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific PiP tests
npm test -- --grep "PiP"

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Categories

1. **Unit Tests** (`PiPVideoGrid.test.tsx`)
   - `getInitials()` function
   - `isParticipantModerator()` function
   - Participant sorting logic
   - Role-based filtering

2. **Component Tests** (`PiPContainer.test.tsx`)
   - Document PiP support detection
   - Role-based viewing logic
   - Style copying functionality
   - LiveKit hook integration

3. **Integration Tests** (`integration.test.tsx`)
   - roomStore PiP state management
   - ControlBar PiP button
   - PiPControls actions
   - Screen share integration
   - Active speaker integration
   - Browser compatibility

### Test Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| PiPContainer | 70% |
| PiPVideoGrid | 80% |
| PiPControls | 75% |
| PiPScreenShare | 65% |

---

## Troubleshooting

### Common Issues

#### 1. PiP Button Does Nothing

**Possible Causes:**
- Browser doesn't support Document PiP
- Permissions not granted
- Already in PiP mode

**Solution:**
- Check browser compatibility
- Grant camera/microphone permissions
- Check console for errors

#### 2. PiP Window Shows "No Participants"

**Possible Causes:**
- All participants have cameras off
- User is attendee and no moderators are present
- Track subscription issues

**Solution:**
- Enable camera on at least one participant
- Check role-based viewing rules
- Verify LiveKit connection

#### 3. Screen Share Not Showing in PiP

**Possible Causes:**
- Screen share track not published
- Screen share ended
- Track subscription delay

**Solution:**
- Verify screen share is active in main window
- Wait a moment for track to propagate
- Check LiveKit dashboard for track status

#### 4. Controls Not Responding

**Possible Causes:**
- LocalParticipant not connected
- Permission restrictions
- Network issues

**Solution:**
- Verify connection status
- Check moderator permissions
- Check network connectivity

### Debug Mode

Enable debug logging in the console:

```javascript
localStorage.setItem('DEBUG_PIP', 'true');
```

This will output detailed PiP-related logs:
- Window open/close events
- Participant filtering decisions
- Control actions
- Error details

### Reporting Issues

When reporting PiP-related issues, include:

1. Browser and version
2. Operating system
3. Steps to reproduce
4. Console logs (with DEBUG_PIP enabled)
5. Screenshot of the issue
6. Number of participants in the meeting

---

## Development Notes

### Key Files

| File | Purpose |
|------|---------|
| `PiPContainer.tsx` | Main container managing PiP window lifecycle |
| `PiPVideoGrid.tsx` | Grid layout with role-based filtering |
| `PiPControls.tsx` | Control buttons for PiP window |
| `PiPScreenShare.tsx` | Screen share display component |
| `roomStore.ts` | Zustand store with PiP state |
| `useAutoPiP.ts` | Hook for automatic PiP activation |
| `usePictureInPicture.ts` | Core PiP functionality hook |

### State Flow

```
User clicks PiP button
        ↓
ControlBar calls togglePiP()
        ↓
roomStore updates isPiPOpen = true
        ↓
PiPContainer detects state change
        ↓
PiPContainer requests Document PiP window
        ↓
Content rendered via React Portal
        ↓
User closes PiP window
        ↓
pagehide event fired
        ↓
roomStore updates isPiPOpen = false
```

### Role-Based Filtering Logic

```javascript
// For Moderators (host/cohost):
// Show: all participants with camera + active speakers + self

// For Attendees:
// Show: moderators + active speakers + self
```

---

## Changelog

### v1.0.0 (Initial Release)
- Basic Document PiP support
- Role-based participant filtering
- Screen share display
- Control buttons
- Active speaker highlighting
