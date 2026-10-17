
# Meead Netlify Functions

This directory contains the server-side API functions for Meead.

## Required environment variables

Configure these variables in Netlify's site environment settings:

- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`

Never commit actual credentials, tokens, or secret values to this repository.

## Available functions

- `auth.js` — registration, login, and current user
- `providers.js` — public provider search
- `provider-manage.js` — provider business management
- `services.js` — service management
- `bookings.js` — customer bookings
- `booking-manage.js` — provider booking management
- `availability.js` — provider working hours
