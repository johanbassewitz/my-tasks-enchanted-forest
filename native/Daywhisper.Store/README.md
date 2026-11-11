# Windows startup helper

This self-contained .NET helper only reads/enables/disables the packaged Windows startup task `DaywhisperStartup`. It has no Microsoft purchase, product catalog or license APIs. Paddle is the sole billing provider for both editions.

Build with `npm run build:store-helper`. The Store APPX includes the executable and its dependencies. Direct NSIS installs use Electron login-item settings and do not need this helper.

Supported invocation: `Daywhisper.Store.exe startup --action status` (or `enable` / `disable`). It rejects all other commands, malformed arguments and unpackaged execution. Windows user or policy restrictions remain authoritative; the app reports unsuccessful enable/disable operations.
