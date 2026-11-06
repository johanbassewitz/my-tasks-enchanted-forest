# Daywhisper Store helper

A packaged Windows desktop child process for Microsoft Store durable add-ons and startup tasks. It must be included **inside the same AppX/MSIX package** as Daywhisper; running the executable from an unpackaged directory is not a supported Store test. No account credentials or product identifiers are embedded.

## Build on Windows

Install .NET 8 SDK, then run from the repository root:

```powershell
dotnet publish native/Daywhisper.Store/Daywhisper.Store.csproj -c Release -r win-x64 --self-contained true -o native/Daywhisper.Store/publish
```

Package **all** output files together, preserving their names, into a fixed resources directory. This is an untrimmed, self-contained deployment, so the client needs no .NET installation. Electron must spawn the fixed `Daywhisper.Store.exe` path, never a renderer-supplied path.

This source has not been compiled in the Linux development environment (no .NET SDK). A Windows CI publish and installed-package smoke test are required before release. Store product discovery and purchases additionally require a reserved/associated Partner Center application with published durable add-ons. An unpackaged or unassociated app cannot validate production commerce.

## Process protocol

Exactly one JSON object is written to stdout, followed by a newline. API/argument exceptions produce exit code 1 and `{ "ok": false, "error": { "code": "0x...", "message": "..." } }`. Completed API calls produce exit code 0. No diagnostic or account data is written to stdout.

| Command | Successful response fields in addition to `ok: true` |
| --- | --- |
| `status --hwnd 12345` | `action: "status"`, `products: [{storeId,title,price,owned}]`, `license: {isActive,isTrial,activeSkuIds: string[]}` |
| `purchase --hwnd 12345 --store-id PRODUCTID` | `action: "purchase"`, `storeId`, `status`, `extendedError: null` or HRESULT string |
| `startup --action status` | `action: "startup"`, `state` |
| `startup --action enable` | `action: "startup"`, actual resulting `state` |
| `startup --action disable` | `action: "startup"`, actual resulting `state` |

HWND is a positive decimal integer string obtained from the live Electron BrowserWindow native handle. Do not convert the handle through an imprecise JavaScript Number. Status and purchase associate StoreContext with this window via `WinRT.Interop.InitializeWithWindow.Initialize`.

Purchase status is one of `Succeeded`, `AlreadyPurchased`, `NotPurchased`, `NetworkError`, `ServerError`. **`ok: true` does not mean a purchase succeeded.** Refresh status after purchase; grant access only from the returned active add-on licenses. On a process timeout, query status before offering a retry because the transaction outcome is unknown. Purchases are limited to durable products associated with this application, confirmed by the Store before opening purchase UI.

`activeSkuIds` contains SKU Store IDs, not Partner Center product tokens. Product `owned` is derived by matching its SKU IDs to active licenses. `price` is the localized Store-formatted price. The UI may display configured products only, but must not manufacture price or ownership for missing products.

Startup states are `Disabled`, `DisabledByUser`, `Enabled`, `DisabledByPolicy`, `EnabledByPolicy`. Treat only `Enabled` and `EnabledByPolicy` as enabled. Respect user/policy disabling; do not write Run registry keys as a fallback. The package manifest must declare a desktop `windows.startupTask` extension pointing to the **main Daywhisper executable**, with `TaskId="DaywhisperStartup"`, `Enabled="false"`, `EntryPoint="Windows.FullTrustApplication"`, and `DisplayName="Daywhisper"`.

## Integration

`new StoreBridge(fixedAbsoluteExecutablePath)` provides `status(hwnd)`, `purchase(storeId, hwnd)`, and `startup('status'|'enable'|'disable')`. It uses execFile without a shell, strict action/response validation, a 1 MiB output limit, and a 30-second timeout (180 seconds for purchase UI). Only expose product IDs selected from the main process's configured allowlist to `purchase`.

Official references:

- https://learn.microsoft.com/en-us/windows/uwp/monetize/in-app-purchases-and-trials
- https://learn.microsoft.com/en-us/windows/apps/develop/ui/display-ui-objects
- https://learn.microsoft.com/en-us/uwp/api/windows.services.store.storecontext
- https://learn.microsoft.com/en-us/uwp/api/windows.services.store.storelicense
- https://learn.microsoft.com/en-us/uwp/api/windows.applicationmodel.startuptask
