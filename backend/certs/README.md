# APNs Key Setup

1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Create a new key with "Apple Push Notifications service (APNs)" enabled
3. Download the .p8 file (e.g., AuthKey_ABC123.p8)
4. Note the Key ID (10-character string shown on the key page)
5. Note your Team ID (from https://developer.apple.com/account — top right)
6. Place the .p8 file in this directory
7. In Datacore notification settings, create an "Apple Push Notifications" channel with:
   - Key File Path: /app/certs/AuthKey_ABC123.p8
   - Key ID: ABC123
   - Team ID: XFD7636PAR
   - Bundle ID: com.chaseburrell.Datacore
   - Use Sandbox: ON (for development) / OFF (for TestFlight/production)
