import { app, Menu, Tray, nativeTheme } from "electron"
import { join } from "path"
import open from "open";

import config from "./config";
import syncdb from "./database"

let tray: Tray | null = null;

function getPath (icon: string) {

    let trayIconBasePath = join(__dirname, "icons", (nativeTheme.shouldUseDarkColors) ? "light" : "dark");

    return join(trayIconBasePath, icon + ".png");

}

let tooltips = {
    "sync": 'BookStack-Sync: Synchronisierung läuft',
    "sync-problem": 'BookStack-Sync: Synchronisierung fehlgeschlagen',
    "sync-down": 'BookStack-Sync: Lokale Instanz wird aktualisiert',
    "sync-up": 'BookStack-Sync: Server wird aktualisiert',
    "book-check": 'BookStack-Sync: Die letze Synchronisierung war erfolgreich'
}

export function updateTrayIcon (icon: string) {

    tray.setToolTip(tooltips[icon] || "");
    tray.setImage(getPath(icon));

}


export function initTrayIcon () {
    
    app.whenReady().then(() => {
    
        tray = new Tray(getPath("sync"));
    
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Jetzt syncronisieren',
                click: () => {
                    updateTrayIcon("sync");
                    syncdb((status) => {
                        updateTrayIcon(status);
                    });
                }
            },
            {
                label: 'Einstellungen öffnen',
                click: () => {
                    open(config.configPath);
                }
            },
            {
                label: 'Beenden',
                click: () => {
                    app.exit();
                }
            }
        ])
        tray.setToolTip(tooltips.sync)
        tray.setContextMenu(contextMenu)
    
    })

}