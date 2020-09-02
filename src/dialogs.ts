import { app, BrowserWindow, screen, ipcMain } from "electron"
import { join } from "path"

export function syncProblem (call: {(version: string)}) {

    app.whenReady().then(() => {

        const mainScreen = screen.getPrimaryDisplay();
        
        const win = new BrowserWindow({
            y: mainScreen.workAreaSize.height - 250 - 60,
            x: mainScreen.workAreaSize.width - 450 - 60,
            width: 450,
            height: 250,
            frame: false,
            resizable: false,
            title: "BookStack-Sync",
            show: false,
            icon: join(__dirname, "icons", "logo.png"),
            backgroundColor: "#282828",
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true
            }
        })

        win.on("ready-to-show", () => {
            win.show();
        })

        ipcMain.on("selected", (event, version) => {
            win.hide();
            win.destroy();
            setTimeout(() => {
                call(version);
            }, 10);
        })
    
        win.loadURL(`file://${__dirname}/assets/sync-problem.html`)

    })


}
