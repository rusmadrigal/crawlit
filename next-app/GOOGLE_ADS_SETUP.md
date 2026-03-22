# Google Ads API Setup for CrawliT

CrawliT uses the Google Ads API for **keyword volume** and **competition** (replacing DataForSEO for these metrics). Intent still comes from DataForSEO.

## 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project or select an existing one
3. **Enable the Google Ads API**:
   - APIs & Services → Library
   - Search "Google Ads API"
   - Click Enable

## 2. OAuth Credentials (if not already set for GA4/GSC)

If you already have OAuth credentials for GA4 and GSC, you only need to add the Google Ads scope. Users must **reconnect** (Connect Google) to grant the new scope.

1. APIs & Services → Credentials → Create Credentials → OAuth client ID
2. Application type: **Web application**
3. Add authorized redirect URIs (e.g. `http://localhost:3000/api/ga4/oauth/callback`)
4. Copy **Client ID** and **Client Secret** to your `.env`:

```
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_SECRET=your-client-secret
```

## 3. OAuth Consent Screen – Add Google Ads Scope

1. APIs & Services → OAuth consent screen
2. Edit app → Scopes → Add or verify:
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`
   - `https://www.googleapis.com/auth/adwords`
3. Save

After adding the scope, users must **Connect Google** again in CrawliT to grant the new permission.

## 4. Google Ads Developer Token

1. Sign in to [Google Ads](https://ads.google.com/)
2. Go to [API Center](https://ads.google.com/aw/apicenter)
3. Apply for a Developer Token:
   - **Test account**: Quick approval, limited to test accounts
   - **Basic access**: For production, needs approval and spend history
4. Copy the Developer Token and add to `.env`:

```
GOOGLE_ADS_DEVELOPER_TOKEN=your-developer-token
```

## 5. Google Ads Customer ID

Each project needs a **Google Ads Customer ID** (format `123-456-7890`). This is the account used for Keyword Planner data.

1. In Google Ads, open the account selector (top right)
2. Copy the Customer ID (with or without dashes)
3. In CrawliT, set it in the project header (input: "Google Ads customer ID")

## 6. Environment Variables Summary

```env
# Existing (GA4 + GSC)
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...

# New for Google Ads
GOOGLE_ADS_DEVELOPER_TOKEN=...

# Optional: default Customer ID for all projects (when project has none set)
GOOGLE_ADS_CUSTOMER_ID=511-720-3937

# Optional: only if using an MCC (Manager) account
# Set to your MCC ID when the Customer ID in the project is a client under that MCC
GOOGLE_ADS_LOGIN_CUSTOMER_ID=123-456-7890
```

## 7. Reconnect Google After Adding Scope

After adding the `adwords` scope:

1. Go to a project in CrawliT
2. Click **Connect Google** (or disconnect and reconnect)
3. Approve the new "Manage your Google Ads accounts" permission

## Troubleshooting

- **403 / Access denied**: Reconnect Google and approve the adwords scope
- **Invalid customer ID**: Use the 10-digit ID with or without dashes (e.g. `1234567890` or `123-456-7890`)
- **Developer token not approved**: Use a test account or wait for Basic access approval
- **No volume data / empty results**: (1) If using an MCC, set `GOOGLE_ADS_LOGIN_CUSTOMER_ID` to your MCC ID and use the client account ID in the project. (2) Reconnect Google to ensure the adwords scope is granted. (3) Some accounts get only ranges instead of exact numbers depending on spend
