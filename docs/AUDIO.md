# Daywhisper audio — 1.2.1 preview

Music is optional and starts only on Play. The title-bar Music button opens a local-file player with track selection, play/pause, stop, repeat and volume. Music continues across page navigation and while minimized/in the tray. Fully quitting stops it. This preview keeps selected files only for the current session; users choose them again after restart. Tracks are not uploaded or included in planner backups.

The artist's recordings are not supplied or bundled yet. Deliver MP3 or WAV masters, titles and artist credits, plus permission to distribute them with the commercial app. Seamless loops are welcome. A curated bundled catalog is a follow-up once recordings arrive.

Moonbell, Woodland and Starlight are original synthesized reminder chimes, made from sine harmonics with soft attack and decay (no third-party samples). Settings has a tone selector, volume and preview. Existing sound on/off preferences are preserved, and legacy backups default to Moonbell at 35%. Native notifications are silent to avoid doubling the OS sound; the app plays the selected chime. Closely spaced alerts share a chime. Audio output must be enabled on the device.

Notifications still require the app running or in the tray. Microsoft Store installation alone does not change this. OS-scheduled notification delivery after explicit Quit is not implemented in this build.

Manual checks: music file load and playback; unsupported file error; switching tracks; repeat; volume; navigation; minimize/tray; full quit; reminder with in-app alerts disabled; mute; upgrade from 1.2.0; Windows shortcut icon refresh. Automated Windows smoke test covers music playback/navigation/stop and saved reminder tone after restart. Listening quality and actual speakers need human verification.
