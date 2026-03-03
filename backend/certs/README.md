# APNs Key Setup

## 1. Generate the Key

1. Go to https://developer.apple.com/account/resources/authkeys/list
2. Create a new key with "Apple Push Notifications service (APNs)" enabled
3. Download the `.p8` file (e.g., `AuthKey_ABC123XYZ.p8`)
4. Note the **Key ID** (10-character string shown on the key page)
5. Note your **Team ID** (from https://developer.apple.com/account — top right corner)

## 2. Configure Environment Variables

Add these to your `.env` file (local dev) or Dockge environment variables (production):

```
APNS_KEY_ID=ABC123XYZ
APNS_TEAM_ID=YOUR_TEAM_ID
APNS_BUNDLE_ID=com.chaseburrell.Datacore
APNS_USE_SANDBOX=false
```

Set `APNS_USE_SANDBOX=true` for development builds, `false` for TestFlight/production.

## 3. Get the .p8 File into the Container

### Local Development

Place the `.p8` file in this directory (`backend/certs/`). The `./backend:/app` volume
mount in `docker-compose.yml` makes it available at `/app/certs/` inside the container.

Set in `.env`:
```
APNS_KEY_FILE=/app/certs/AuthKey_ABC123XYZ.p8
```

### Production (Dockge / HexOS / TrueNAS)

The production compose file bind-mounts a host directory to `/app/certs:ro` (read-only).

**Setup steps:**

1. In TrueNAS Scale, create a dataset for the key file:
   - Go to **Storage > Pools** and create a dataset (e.g., `datacore/apns-certs`)
   - Or use an existing path like `/mnt/datacore/apns-certs`

2. Upload your `.p8` file to that dataset:
   - Use the TrueNAS file browser, SMB share, or SSH to place the file there
   - Rename it to `apns-key.p8` (the name the compose file expects)

3. In Dockge, set the `APNS_CERTS_PATH` env var to the dataset path:
   ```
   APNS_CERTS_PATH=/mnt/datacore/apns-certs
   ```
   (defaults to `/mnt/datacore/apns-certs` if not set)

4. Set the remaining env vars in Dockge:
   ```
   APNS_KEY_ID=your_key_id
   APNS_TEAM_ID=your_team_id
   ```

5. Deploy — the container mounts the dataset read-only at `/app/certs/`,
   and the `APNS_KEY_FILE` env var points to `/app/certs/apns-key.p8`.

The key file persists in TrueNAS storage, survives container rebuilds,
and is easily managed through the TrueNAS UI.
