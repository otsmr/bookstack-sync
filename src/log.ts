
import { app, BrowserWindow, Menu, ipcMain } from "electron"
import { normalize, join } from "path";
import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync, watchFile } from "fs";
import moment from "moment";

const appdata = join(normalize(app.getPath("appData")), "bookstack-sync");
mkdirSync(appdata, { recursive: true })

const logPath = join(appdata, "sync.log");
if (!existsSync(logPath)) writeFileSync(logPath, "");

const writeToFile = (msg: string) => {



    const time = moment().format("DD.MM.YY HH.mm.ss");

    appendFileSync(logPath, `[${time}] ${msg}\n`);

}

export default {
    info: (msg: string) => {
        writeToFile(`INFO > ${msg}`);
    },
    error: (msg: string) => {
        writeToFile(`ERROR > ${msg}`);
    }
}

let win: BrowserWindow | null = null;

export function displayLog () {

    if (win !== null) {
        return win.show();
    }
    app.whenReady().then(() => {
        
        win = new BrowserWindow({
            width: 1200,
            height: 800,
            title: "Log - BookStack-Sync",
            show: false,
            icon: join(__dirname, "icons", "logo.png"),
            backgroundColor: "#282828",
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: true
            }
        })

        let menu = new Menu();

        win.setMenu(menu);

        win.on("ready-to-show", () => {
            win.show();

            function send () {
                win.webContents.send('logdata', readFileSync(logPath).toString());
            }

            watchFile(logPath, send)
            send();

        })

        win.on("close", (event) => {
            event.preventDefault();
            win.hide();
        })

        // ipcMain.on("selected", (event, version) => {
        //     call(version);
        //     win.close();
        // })
    
        win.loadURL(`file://${__dirname}/assets/logs.html`)

    })
}