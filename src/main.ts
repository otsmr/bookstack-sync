import { app } from "electron"
import AutoLaunch from "auto-launch"

import syncdb from "./database"
import { initTrayIcon, updateTrayIcon } from "./electron"
import config from "./config"


if (!app.requestSingleInstanceLock()) app.quit();

initTrayIcon();

const exe = app.getPath("exe");
if (!exe.endsWith("electron.exe")) {

    const autolaunch = new AutoLaunch({
        name: 'BookStack-Sync',
        path: exe,
    });

    if (config.get("autoStart")) autolaunch.enable();
    else autolaunch.disable();

}

// -------------------------------------
// Syncronisation wird gestartet

syncdb((status) => {
    updateTrayIcon(status);
});

setInterval(() => {

    console.log("CHECK");

    syncdb((status) => {
        updateTrayIcon(status);
    });
    
}, config.get("syncIntervallInMinutes") * 1000 * 60);




// ftp://bookstack/storage/uploads/ -> ./data/bookstack/www/
// ftp://bookstack/public/uploads/ -> ./data/bookstack/www/uploads