# Project Status

## Implemented

- Expo + React Native + TypeScript project scaffold in the current repository.
- Typed app shell with React Query, Supabase client wrapper, secure auth storage, and navigation.
- Domain types for profiles, wallets, wallet members, vouchers, attachments, reminder settings, and future processing jobs.
- Repository and service boundaries for auth, profiles, wallets, vouchers, attachments, and push token registration.
- Starter screens for splash, login, register, voucher list, voucher details, create/edit voucher, and settings.
- Voucher form Zod schemas and attachment picker scaffolding for image/PDF selection.
- Placeholder family wallet module and future-ready wallet role types.
- Fallback repository behavior when Supabase business tables are not created yet.
- Focused iPhone-friendly PWA shell for web usage (manifest, install icons, Apple home-screen metadata, standalone launch mode, and minimal service worker shell caching).

## iPhone PWA Usage

- The web app can now be added to an iPhone home screen and launched in an app-like standalone window.
- How to add it:
  1. Open the deployed web URL in Safari on iPhone.
  2. Tap `Share`.
  3. Tap `Add to Home Screen`, then tap `Add`.
- Current limitations vs native:
  - Offline support is intentionally minimal (cached app shell + static assets only); live voucher/auth data still depends on network access.
  - Native-only capabilities (for example full background execution and native push UX parity) remain limited in Safari PWA mode.

## Scaffold Only

- Voucher attachment uploads are not fully implemented yet.
- Settings persistence is scaffolded; reminder/profile persistence still needs full backend wiring.
- Push reminder scheduling is prepared for server-side implementation but not yet scheduled on the backend.
- Shared/family wallet UI is intentionally placeholder-only in MVP.

## Intentionally Deferred

- OCR extraction.
- Email import / ingestion.
- Barcode scanning.
- Currency conversion.
- Server-side automation pipelines beyond scaffolding hooks and types.

## Manual Supabase Configuration Required

- Create the Supabase project and set the anon key and URL in `.env`.
- Create the business tables referenced by the repositories: `profiles`, `wallets`, `wallet_members`, `vouchers`, `voucher_attachments`, `device_push_tokens`, and optionally `reminder_settings` / `voucher_processing_jobs`.
- Enable Row Level Security on all business tables and add policies aligned with wallet membership.
- Create a private storage bucket for voucher attachments.
- Implement signed URL policies and any server-side reminder scheduling job or Edge Function.
- Configure Expo/EAS push notification credentials for iOS and Android builds.
