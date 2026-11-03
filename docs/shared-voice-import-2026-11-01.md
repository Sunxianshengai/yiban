# Existing-account voice distribution

On 2026-11-01 the project owner requested cloning the supplied WAV and adding it to every currently registered account's voice library.

- Reference SHA-256: `de20f56dd20335ffd04e52459367cc006f7ef067bacd97f3c2f58d0b6f7cff76`.
- Voice: `qwen-audio-3.1-tts-plus-ybde20f56d-9dbc7961c3fc45ab95f9a195a9a74d39`.
- Display name: 基准克隆音色.
- Provider query returned `OK`; a valid 230444-byte WAV preview was synthesized before distribution.
- All 6 accounts in the import snapshot received a separately owned ready library entry pointing to the same upstream voice. Existing voice selections were preserved.
- Registration is idempotent and the import receipt is retained in the system collection. The temporary sample-pinned import endpoint is removed after completion.

The initial create request exceeded the existing 45-second deadline. Reconciliation found no voice; one retry with a longer deadline returned the voice ID and `DEPLOYING`, then `OK`. Regular enrollment now allows 105 seconds within the existing 120-second route limit; status queries retain 45 seconds. This avoids abandoning successful but slow creation too early.
