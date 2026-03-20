# Google Search Console (Performance chart)

## OAuth

The same **Connect Google** flow used for GA4 now requests:

- `https://www.googleapis.com/auth/analytics.readonly`
- `https://www.googleapis.com/auth/webmasters.readonly` (Search Console)

**Existing users** must use **Connect Google** (includes `reauth=1`), which clears the old refresh token and forces a new consent so both scopes apply. If Search Console still fails, revoke the app at [Google Account permissions](https://myaccount.google.com/permissions) and connect again.

## Google Cloud setup

1. Enable **Google Search Console API** for your project (APIs & Services → Library).
2. On the OAuth consent screen, add the **webmasters.readonly** scope (or full Search Console read scope) if you manage scopes manually.

## Metric: “Page indexing (GSC)”

Google does **not** expose the Page indexing report totals through a public API. This app uses **Search Analytics** with dimension `page` (monthly) or `date` + `page` (daily) to count **distinct URLs that had search impressions** in each period.

That is a practical proxy for “pages visible in Search” but it is **not** identical to the “Indexed pages” number in the Search Console UI.

## Property URL

Pick the property that matches your site, e.g.:

- `https://www.example.com/` (URL-prefix)
- `sc-domain:example.com` (Domain property)

The domain in the CrawliT project should align with the GSC property you select.
