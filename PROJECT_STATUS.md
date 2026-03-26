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