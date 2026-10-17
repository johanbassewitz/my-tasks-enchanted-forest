## Install on Windows

[Download the Windows installer](https://github.com/{{REPO}}/releases/download/{{TAG}}/My-Tasks-Setup-{{VERSION}}-x64.exe), run it, then open **My Tasks** from its desktop icon.

The installer creates one **My Tasks** desktop shortcut and a Start menu entry. Supporting files stay in the normal installation folder. Node.js and source files are not required. Installation is for your Windows user and does not require administrator privileges.

Already using My Tasks? Run the new installer over it. Your tasks are kept and upgraded the first time {{VERSION}} opens; after that, older versions cannot open them, so use **Settings → Export / Backup** first if you might go back.

## What's new in {{VERSION}}

- **Phases, tasks and steps.** Group the tasks of a bigger plan into ordered phases with dates, a category and a colour, and break tasks into steps with their own date, time and reminder. Finishing every step completes the task. The Tasks page has a new **Phases** view next to the familiar **List**.
- **Priority colours.** High tasks are highlighted in red with a flag and listed first; Medium tasks get a yellow label; Low stays plain. Home shows how many High tasks are still open.
- Delete buttons show a bin icon again.

## Included

Eight sections: Home, Calendar, Focus, Categories, Tasks, Events, Reminders and Settings. Local storage, phases, tasks with steps, events, priorities, recurrence, reminders, focus history, backups, search and a Google Calendar setup guide.

## Verification and limits

- All **75 automated tests** passed locally and on the GitHub Windows runner. Production compilation, release validation, installer packaging, checksum generation and release upload passed.
- Unsigned Windows x64 build; Windows may show a publisher warning (choose **More info → Run anyway**).
- Google Calendar requires a one-time Desktop OAuth client setup in Settings. Google integration was tested with mocked responses; live authorization was not tested. Phases and steps stay on your computer and are not synced to Google.
- Reminders require the app to be open or running in the tray.
- Native installation, tray, notification and display-scaling behavior still require physical Windows verification.
- Advanced Google recurrence-instance editing and unsupported imported recurrence rules are limited; see [the verification report](https://github.com/{{REPO}}/blob/main/docs/VERIFICATION.md).
