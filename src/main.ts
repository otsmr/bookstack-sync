import { app } from "electron"
import AutoLaunch from "auto-launch"

import syncdb from "./database"
import syncfiles from "./files"
import { initTrayIcon, updateTrayIcon } from "./electron"
import config from "./config"

import { removeOldFiles } from "./readdir"

import log from "./log"

app.on("window-all-closed", () => {
    // Verhindert: app.quit();
});

app.on("will-quit", () => {
    log.info(" - BookStack-Sync geschlossen - ");
})

log.info(" - BookStack-Sync gestartet - ");
if (!app.requestSingleInstanceLock()) app.quit();


initTrayIcon();
removeOldFiles();

const exe = app.getPath("exe");
if (!exe.endsWith("electron.exe")) {

    const autolaunch = new AutoLaunch({
        name: 'BookStack-Sync',
        path: exe,
    });

    if (config.get("autoStart")) autolaunch.enable();
    else autolaunch.disable();

}

export function syncall () {

    syncdb(() => {

        syncfiles(() => {
            log.info("Syncronisation erfolgreich beendet");
        });
        
    });

}

// -------------------------------------
// Syncronisation wird gestartet

setInterval(() => {
    log.info("Syncronisation automatisch gestartet");
    syncall();
}, config.get("syncIntervallInMinutes") * 1000 * 60);

log.info("Syncronisation automatisch beim ersten Start gestartet");
syncall();