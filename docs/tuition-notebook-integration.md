# Tuition Notebook Integration Guide

This document describes how Tuition Notebook (TN) students and teachers can access the Meet Conference video meeting system using API keys.

---

## Overview

Tuition Notebook users will access the meeting system through API key authentication. The integration supports:

- **Teachers** → Full moderator access (can control meetings, admit participants)
- **Students** → Attendee access (join meetings, participate)
- **Class-based isolation** → Each class has its own room with controlled access

---

## Architecture

```
┌─────────────────────┐         ┌─────────────────────┐
│  Tuition Notebook   │────API──▶│   Meet Conference   │
│  (Your App)         │   Key    │   Backend           │
└─────────────────────┘         └─────────────────────┘
        │                               │
        │                   ┌───────────┴───────────┐
        │                   │                       │
        │            ┌──────▼──────┐         ┌──────▼──────┐
        │            │  Database   │         │  LiveKit    │
        │            │  (Rooms,    │         │  (Video     │
        │            │   Users)    │         │   Server)   │
        │            └─────────────┘         └─────────────┘
        │
    Class/Student/Teacher
```

---

## User Roles & Permissions

| Role in Tuition Notebook | Meeting Access | Can Moderator Actions |
|--------------------------|----------------|----------------------|
| Teacher / Tutor | Moderator (host/cohost) | Yes - control meeting |
| Student | Attendee | No - just participate |

---

## Implementation for Tuition Notebook

### 1. Get API Key

Request an API key with the following permissions:

```json
{
  "token": {
    "generate": true
  },
  "rooms": {
    "create": false,
    "read": true,
    "update": false,
    "delete": false
  }
}
```

This allows the TN system to generate tokens but prevents unauthorized room creation/deletion.

### 2. Integration Code

Create a service class in Tuition Notebook:

```typescript
// TuitionNotebookMeetService.ts

interface TNUser {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'student';
  classId?: string;
}

interface MeetingToken {
  token: string;
  livekit_url: string;
  identity: string;
  role: string;
  join_url: string;
}

interface CreateRoomRequest {
  name: string;        // e.g., "math-101"
  title: string;       // e.g., "Math Class - Grade 10"
  waitingRoomEnabled?: boolean;
}

export class TuitionNotebookMeetService {
  private readonly apiBaseUrl: string;
  private readonly apiKey: string;
  private readonly frontendUrl: string;

  constructor(apiBaseUrl: string, apiKey: string, frontendUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.apiKey = apiKey;
    this.frontendUrl = frontendUrl;
  }

  // ============================================
  // LINK GENERATION - Two Types of Links
  // ============================================

  /**
   * Generate a MODERATOR link for teacher
   * Used by teachers to access meeting with full control
   * 
   * @param className - The class/room identifier (e.g., "math-101")
   * @returns Full URL that teacher clicks to join as moderator
   */
  generateModeratorLink(className: string): string {
    return `${this.frontendUrl}/join/${className}?role=moderator`;
  }

  /**
   * Generate a GUEST/PARTICIPANT link for students
   * Used by students to join as attendees
   * 
   * @param className - The class/room identifier (e.g., "math-101")
   * @returns Full URL that students click to join as guest
   */
  generateParticipantLink(className: string): string {
    return `${this.frontendUrl}/join/${className}?role=guest`;
  }

  /**
   * Generate both links at once (useful for teacher dashboard)
   * 
   * @param className - The class/room identifier
   * @returns Object containing both moderator and participant links
   */
  generateMeetingLinks(className: string): { moderator: string; participant: string } {
    return {
      moderator: this.generateModeratorLink(className),
      participant: this.generateParticipantLink(className)
    };
  }

  /**
   * Alternative: Get actual guest token for student
   * Use this if you want pre-authenticated access without student entering name
   * 
   * @param className - The class/room identifier  
   * @param studentName - Student's display name
   * @returns Token response with join URL
   */
  async getGuestToken(className: string, studentName: string): Promise<MeetingToken> {
    const response = await fetch(`${this.apiBaseUrl}/external/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        room: className,
        identity: `tn_guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: studentName,
        role: 'attendee',
        metadata: {
          source: 'tuition-notebook',
          access_type: 'guest_token'
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to generate guest token: ${error.error}`);
    }

    return response.json();
  }

  /**
   * Get meeting access token for a Tuition Notebook user
   * 
   * @param user - The TN user requesting access
   * @param roomName - The class room name (e.g., "math-101")
   * @returns Meeting token with join URL
   */
  async getMeetingToken(user: TNUser, roomName: string): Promise<MeetingToken> {
    // Map TN roles to Meeting roles
    // Teachers get moderator, students get attendee
    const meetingRole = user.role === 'teacher' ? 'moderator' : 'attendee';
    
    const response = await fetch(`${this.apiBaseUrl}/external/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        room: roomName,
        identity: `tn_${user.id}`,           // Unique identity: tn_user123
        name: user.name,                     // Display name from TN
        role: meetingRole,                   // Based on TN role
        metadata: {
          source: 'tuition-notebook',
          tn_user_id: user.id,
          tn_class_id: user.classId,
          tn_email: user.email
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get meeting token: ${error.error}`);
    }

    return response.json();
  }

  /**
   * Create a class room (if not exists)
   * Usually called when a teacher creates a new class
   */
  async createClassRoom(request: CreateRoomRequest): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/external/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        name: request.name,                          // e.g., "math-101"
        title: request.title,                        // e.g., "Mathematics - Grade 10"
        waitingRoomEnabled: request.waitingRoomEnabled ?? true,
        metadata: {
          created_by: 'tuition-notebook',
          class_id: request.name                     # Using room name as class ID
        }
      })
    });

    return response.json();
  }

  /**
   * Get room information
   */
  async getRoomInfo(roomName: string): Promise<any> {
    const response = await fetch(`${this.apiBaseUrl}/external/rooms/${roomName}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    return response.json();
  }

  /**
   * Check if a meeting room is active
   */
  async isRoomActive(roomName: string): Promise<boolean> {
    try {
      const room = await this.getRoomInfo(roomName);
      return room.status === 'active';
    } catch {
      return false;
    }
  }
}

// ============================================
// USAGE EXAMPLES - TWO LINK SYSTEM
// ============================================

// Initialize the service
const meetService = new TuitionNotebookMeetService(
  'https://your-meet-backend.com',
  'tn_api_key_xxxxx',
  'https://meet.yourdomain.com'
);

// ============================================
// EXAMPLE 1: Generate Both Links for a Class
// ============================================

async function teacherManagesClass() {
  const className = 'math-101';
  
  // Generate both links - shown in teacher dashboard
  const links = meetService.generateMeetingLinks(className);
  
  console.log('Moderator Link (for teacher):', links.moderator);
  // Output: https://meet.yourdomain.com/join/math-101?role=moderator
  
  console.log('Participant Link (for students):', links.participant);
  // Output: https://meet.yourdomain.com/join/math-101?role=guest
}

// ============================================
// EXAMPLE 2: Teacher Uses Moderator Link
// ============================================

/*
 * Teacher clicks: https://meet.yourdomain.com/join/math-101?role=moderator
 * 
 * Frontend Flow:
 * 1. Detects ?role=moderator query param
 * 2. Shows "Enter your name" + "Join as Moderator" button
 * 3. Teacher enters "Mr. John Smith" 
 * 4. System calls /token API with role=moderator
 * 5. Teacher joins with full moderator permissions
 */

// ============================================
// EXAMPLE 3: Student Uses Guest Link  
// ============================================

/*
 * Student clicks: https://meet.yourdomain.com/join/math-101?role=guest
 * 
 * Frontend Flow:
 * 1. Detects ?role=guest query param
 * 2. Shows "Enter your name" + "Join as Guest" button
 * 3. Student enters "Alice Johnson"
 * 4. System calls /token/guest API (no API key needed!)
 * 5. If waiting room enabled → Student waits for approval
 * 6. Student joins as attendee
 */

// ============================================
// EXAMPLE 4: Generate Links for Class Dashboard
// ============================================

function displayClassLinksInDashboard(classData: { id: string; name: string; title: string }) {
  const links = meetService.generateMeetingLinks(classData.id);
  
  return {
    className: classData.name,
    classTitle: classData.title,
    moderatorLink: links.moderator,
    participantLink: links.participant,
    // For embedding in HTML/emails:
    shareableLinks: {
      __html: `
        <div>
          <p><strong>Teacher Link:</strong> <a href="${links.moderator}">${links.moderator}</a></p>
          <p><strong>Student Link:</strong> <a href="${links.participant}">${links.participant}</a></p>
        </div>
      `
    }
  };
}

// ============================================
// EXAMPLE 5: Alternative - Pre-generated Guest Token
// ============================================

async function generateGuestAccessForStudent() {
  // Option A: Generate link, let student enter their name
  const link = meetService.generateParticipantLink('math-101');
  // Student clicks → enters name → joins
  
  // Option B: Pre-generate token (student skips name entry)
  const tokenResponse = await meetService.getGuestToken('math-101', 'Alice Johnson');
  
  console.log('Pre-authenticated join URL:', tokenResponse.join_url);
  // Student clicks → directly joins without entering name
  // Useful for younger students who shouldn't type their name
}

// ============================================
// Class Management Flow
// ============================================

/*
 * TEACHER FLOW (Moderator):
 * 1. Log in to Tuition Notebook
 * 2. Navigate to "My Classes"
 * 3. Click "Start Meeting" for a class
 * 4. System calls getMeetingToken() with teacher role
 * 5. Teacher joins with moderator permissions
 * 6. Teacher can: mute students, turn off cameras, admit from waiting room, end meeting
 * 
 * STUDENT FLOW (Attendee):
 * 1. Log in to Tuition Notebook  
 * 2. Navigate to "My Classes"
 * 3. Click "Join Meeting" for an active class
 * 4. System calls getMeetingToken() with student role
 * 5. If waiting room enabled → wait for teacher approval
 * 6. Student joins as attendee (can speak, share camera, participate)
 */

export default TuitionNotebookMeetService;
```

---

## Two Types of Meeting Links

The integration supports two types of links that can be generated from Tuition Notebook:

### 1. Moderator Link (Teacher Only)

Used by teachers to start/manage meetings.

```
https://meet.yourdomain.com/join/{className}?role=moderator
```

**Features:**
- Pre-filled role as moderator
- Teacher enters their name
- Automatic moderator permissions in meeting IF they are host/co-host
- Can control all meeting aspects
- **Security:** Only grants moderator if user is room host or co-host. Falls back to attendee otherwise.

### 2. Participant Link (Guest/Student)

Used by students to join meetings.

```
https://meet.yourdomain.com/join/{className}?role=guest
```

**Features:**
- Pre-filled as guest attendee
- Student enters their name
- Joins as attendee (guest never gets moderator)
- If waiting room enabled, waits for teacher approval
- **Security:** Guests always get attendee role (no moderator permission)

---

## Security Rules (Applied Everywhere)

Both the External API and Frontend use the same permission check:

| Scenario | Access Granted |
|----------|----------------|
| User is room creator (host) | ✅ Full 'host' role |
| User is co-host | ✅ 'moderator' role |
| User has API key with `token.generate: true` | ✅ 'moderator' role |
| Regular user with link ?role=moderator but not host/co-host | ❌ Falls back to attendee |
| Guest with link ?role=guest | ❌ Always attendee |
| Guest requests ?role=moderator | ❌ Rejected (guests can't be moderators) |

### Permission Flow

```
User requests moderator role
         │
         ▼
┌─────────────────────────┐
│  Is this user host?     │───yes───► Get 'host' role
└─────────────────────────┘
         │ no
         ▼
┌─────────────────────────┐
│  Is this user co-host?  │───yes───► Get 'moderator' role
└─────────────────────────┘
         │ no
         ▼
┌─────────────────────────┐
│  Has API key permission?│───yes───► Get 'moderator' role  
└─────────────────────────┘
         │ no
         ▼
    Fall back to 'attendee'
```

---

## Implementation for Two Links

| Action | Teacher (Moderator) | Student (Attendee) |
|--------|---------------------|-------------------|
| Start meeting | ✅ | ❌ |
| End meeting | ✅ | ❌ |
| Mute participants | ✅ | ❌ |
| Turn off participant cameras | ✅ | ❌ |
| Admit from waiting room | ✅ | ❌ |
| Remove participants | ✅ | ❌ |
| Share screen | ✅ | ✅ |
| Use microphone | ✅ | ✅ |
| Use camera | ✅ | ✅ |
| Chat in meeting | ✅ | ✅ |
| View participant list | ✅ | ✅ |

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TUITION NOTEBOOK                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TEACHER DASHBOARD                          STUDENT DASHBOARD             │
│   ┌─────────────────────┐                   ┌─────────────────────┐        │
│   │  My Classes         │                   │  My Classes         │        │
│   │  ─────────────      │                   │  ─────────────      │        │
│   │  📚 Math 101        │                   │  📚 Math 101        │        │
│   │     [Start Meeting] │                   │     [Join Meeting]  │        │
│   │     [View Links]────┼───►LINK GENERATION                   │        │
│   │  📚 Science 102     │                   │  📚 Science 102     │        │
│   └─────────────────────┘                   └─────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEET CONFERENCE BACKEND                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   generateMeetingLinks(className)                                           │
│   │                                                                         │
│   ├──► moderatorLink:  /join/{class}?role=moderator                        │
│   │                                                                          │
│   └──► participantLink: /join/{class}?role=guest                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MEET CONFERENCE FRONTEND                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CASE 1: MODERATOR LINK                                                    │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  https://meet.../join/math-101?role=moderator                       │   │
│   │                                                                     │   │
│   │  ╔═══════════════════════════════════════════════════════════════╗ │   │
│   │  ║                    JOIN MEETING                          ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║  Room: Math 101                                              ║     │   │
│   │  ║  Role: Moderator (Teacher)                                   ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║  Your Name: [ Mr. John Smith            ]                   ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║         [ 🚪 Join as Moderator ]                            ║     │   │
│   │  ╚═══════════════════════════════════════════════════════════════╝ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│   CASE 2: GUEST LINK                                                        │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  https://meet.../join/math-101?role=guest                          │   │
│   │                                                                     │   │
│   │  ╔═══════════════════════════════════════════════════════════════╗ │   │
│   │  ║                    JOIN MEETING                          ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║  Room: Math 101                                              ║     │   │
│   │  ║  Role: Guest (Student)                                       ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║  Your Name: [ Alice Johnson              ]                  ║     │   │
│   │  ║                                                               ║     │   │
│   │  ║         [ 🚪 Join as Guest ]                                ║     │   │
│   │  ╚═══════════════════════════════════════════════════════════════╝ │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Where to Display Links in Tuition Notebook

### Teacher View (Class Card)
```html
<div class="class-card">
  <h3>Mathematics - Grade 10</h3>
  <p>Meeting Links (share with students):</p>
  
  <!-- Copy buttons -->
  <button onclick="copyLink('${moderatorLink}')">📋 Copy Teacher Link</button>
  <button onclick="copyLink('${participantLink}')">📋 Copy Student Link</button>
  
  <!-- Direct links -->
  <div class="links">
    <a href="${moderatorLink}" class="teacher-link">
      🔧 Teacher Link (for you)
    </a>
    <a href="${participantLink}" class="student-link">
      👥 Student Link (share with students)
    </a>
  </div>
</div>
```

---

## Security Considerations

1. **API Key Security**
   - Store API key in environment variables, not in source code
   - Use HTTPS for all API calls
   - Rotate API keys periodically

2. **User Identity Mapping**
   - Always prefix identity with `tn_` to avoid conflicts
   - Example: `tn_user123` not just `user123`

3. **Class Isolation**
   - Each class gets its own room
   - Student from one class cannot access another class's meetings
   - Use class ID as room name suffix

---

## Environment Setup

```bash
# .env file (add to Tuition Notebook)
MEET_API_URL=https://your-meet-backend.com
MEET_API_KEY=tn_live_xxxxxxxxxxxxx
```

---

## Error Handling

```typescript
try {
  const result = await meetService.getMeetingToken(user, roomName);
} catch (error) {
  if (error.message.includes('Room not found')) {
    // Teacher needs to create the room first
    console.log('Class room does not exist. Please contact your teacher.');
  } else if (error.message.includes('API key does not have permission')) {
    // API key missing required permissions
    console.log('Integration error. Please contact administrator.');
  } else {
    // Network or other error
    console.log('Unable to connect to meeting server.');
  }
}
```

---

## Testing Checklist

- [ ] Teacher can create a new class room
- [ ] Teacher can start a meeting and gets moderator access
- [ ] Student can join a meeting with attendee access  
- [ ] Waiting room works (student waits, teacher admits)
- [ ] Teacher can mute student and remove from meeting
- [ ] Student cannot access another class's meeting
- [ ] API calls fail gracefully with proper error messages

---

## Need Help?

Contact the Meet Conference administrator to:
- Get an API key with `token.generate` permission
- Configure room settings (waiting room, max participants)
- Set up custom room names for your classes