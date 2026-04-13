#!/bin/bash
# Test external API directly on backend port

echo "Testing External API on Backend (port 4000)..."

# Health check (no auth required)
echo ""
echo "=== Health Check ==="
curl -s http://127.0.0.1:4000/external/health

echo ""
echo "=== Create Room ==="
curl -s -X POST http://127.0.0.1:4000/external/rooms \
  -H "Authorization: Bearer tn_a1b2c3d4e5f6g7h8i9j0x1a2x3y4z5z6a7" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-room","title":"Test Room"}'

echo ""
echo "=== Get Token ==="
curl -s -X POST http://127.0.0.1:4000/external/token \
  -H "Authorization: Bearer tn_a1b2c3d4e5f6g7h8i9j0x1a2x3y4z5z6a7" \
  -H "Content-Type: application/json" \
  -d '{"room":"test-room","identity":"test-user","name":"Test User","role":"attendee"}'

echo ""
echo "=== Test Complete ==="
