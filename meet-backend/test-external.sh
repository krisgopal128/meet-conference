#!/bin/bash
# Test external API

echo "Testing External API..."

# Health check (no auth required)
echo ""
echo "=== Health Check ==="
curl -s http://localhost:4000/external/health

echo ""
echo "=== Create Room ==="
curl -s -X POST http://localhost:4000/external/rooms \
  -H "Authorization: Bearer tn_test_api_key_2026" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-room","title":"Test Room"}'

echo ""
echo "=== Get Token ==="
curl -s -X POST http://localhost:4000/external/token \
  -H "Authorization: Bearer tn_test_api_key_2026" \
  -H "Content-Type: application/json" \
  -d '{"room":"test-room","identity":"test-user","name":"Test User","role":"attendee"}'

echo ""
echo "=== Test Complete ==="
