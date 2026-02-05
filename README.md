# Proof

Social accountability mobile app built with Expo Router and Supabase. Create challenges, check in to keep streaks alive, and share photo “proof” with friends who can like and cheer you on.

## Repo layout
- `Proof/` – the Expo app source.
- `.env` – local environment secrets (kept out of git).

## Quickstart
```bash
cd Proof          # app source directory
npm install       # install dependencies
npm run start     # choose iOS / Android / web
```
If Metro cache acts up: `npx expo start --clear`.

## Environment
Create a `.env` in the repo root (already ignored):
```
PUBLIC_SUPABASE_URL=...
ANON_PUBLIC_KEY=...
SERVICE_ROLE_KEY=...
LETTA_API_KEY=...
LETTA_CHATBOT_MODEL=...
LETTA_IMAGE_VERIFIER_MODEL=...
```

## What’s inside
- Goal tracking: challenges with start/end dates, frequencies, streaks, and check‑ins.
- Social feed: photo proofs with captions, likes/unlikes.
- Friends: send/accept requests; view friends’ active goals.
- AI assistant: floating Letta chatbot for quick coaching.

## Scripts (from `Proof/`)
- `npm run start` – run Metro and select target.
- `npm run ios` / `npm run android` / `npm run web` – platform shortcuts.
- `npm run lint` – lint with Expo config.

## Contributing
Keep secrets in `.env`. Document Supabase schema/policy changes. Prefer typed `expo-router` routes for new screens.
