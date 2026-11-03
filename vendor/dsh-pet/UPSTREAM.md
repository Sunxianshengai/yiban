# dsh-pet integration

Source: https://github.com/PC2005-cloud/dsh-pet
Commit: 31aa345b11a18fc16d5fd35c42b8b9441071170e
Code copyright (c) 2026 PC2005-cloud; MIT license in LICENSE.

The client and shared code are preserved for the original interface, playback,
menus, settings, physics, and multi-pet behavior. Tests, DSH host services and
upstream character media/prompts are excluded. The HTTP route constant is adapted
to /api/pet. Local integration changes are documented here as they are made.
All bundled character footage comes from the user's own supplied files.

Integration adaptations:
- The API prefix points to the authenticated Yiban pet API.
- Chat uses a 120-second timeout and a retry-stable idempotency key.
- React 19 JSX normalization and lifecycle isolation are in the host component.
- The default font is the device system font; the upstream candy font and cursor
  images are not distributed. Font sizes match the host's validated 12–40 range.
- Click feedback is a locally synthesized sine tone, not the upstream sound file.
- Manual speech uses the device's SpeechSynthesis API.
- Image/voice input buttons explain that these features live in the main chat.
- Settings omit DSH-only model, filesystem, uninstall, shortcut and mobile cards;
  the Windows tray remains available rather than exposing an ineffective switch.
- DSH theme alias tokens are supplied by the host; original control CSS remains.

The upstream code's MIT notice is retained. No upstream whale media, meme images,
sound recording, proprietary font or character prompt is included.
