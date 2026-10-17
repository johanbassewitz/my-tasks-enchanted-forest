## What's new in 1.1.0

- **Phases, tasks and steps.** Group the tasks of a bigger plan into ordered phases with dates, a category and a colour, and break tasks into steps with their own date, time and reminder. Finishing every step completes the task. The Tasks page has a new **Phases** view next to the familiar **List**.
- **Priority colours.** High tasks are highlighted in red with a flag and listed first; Medium tasks get a yellow label; Low stays plain. Home shows how many High tasks are still open.
- Delete buttons show a bin icon again.

Already using My Tasks? Run the new installer; your tasks are kept and upgraded automatically the first time 1.1.0 opens. After that, older versions cannot open the upgraded data, so export a backup first (**Settings → Export / Backup**) if you might want to go back.

## Install

Download the **My-Tasks-Setup-…-x64.exe** file from the assets below.

Run the installer. It installs My Tasks for your Windows user, creates a desktop and Start menu shortcut, and opens the app. Use the **My Tasks** icon afterward. No Node.js, source checkout, administrator account or separate app account is needed.

Tasks stay on your computer. To connect Google Calendar, open **Settings → Google Calendar → Setup guide**. A one-time Google Desktop OAuth client configuration is still required; no shared Google client or account is bundled.

This release is unsigned. Native installation and notification behavior should be checked by the maintainer before publishing this draft. See the repository's verification report for the environment checks and recurrence/synchronization limits. Reminders run while the application is open or in the tray; they cannot run when fully quit or the computer is off.
