
import { app, BrowserWindow, Menu, ipcMain } from "electron"
import { normalize, join } from "path";
import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync, watchFile, unwatchFile } from "fs";
import moment from "moment";

const appdata = join(normalize(app.getPath("appData")), "bookstack-sync");
mkdirSync(appdata, { recursive: true })

const logPath = join(appdata, "sync.log");
if (!existsSync(logPath)) writeFileSync(logPath, "");

const writeToFile = (msg: string) => {

    console.log(msg);

    const time = moment().format("DD.MM.YYYY HH:mm:ss");

    appendFileSync(logPath, `[${time}] ${msg}\n`);

}

export default {
    info: (msg: string) => {
        writeToFile(`INFO > ${msg}`);
    },
    error: (msg: string) => {
        writeToFile(`ERROR > ${msg}`);
    },
    warning: (msg: string) => {
        writeToFile(`WARNING > ${msg}`);
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

        function updateLog () {
            if (win) win.webContents.send('logdata', readFileSync(logPath).toString());
        }

        win.on("ready-to-show", () => {
            win.show();

            watchFile(logPath, updateLog)
            updateLog();
        })
        
        // win.webContents.openDevTools();

        win.on("closed", () => {
            win = null;
            unwatchFile(logPath);
        });

        ipcMain.on("clearlog", (event, version) => {
            writeFileSync(logPath, "");
            updateLog();
        })
    
        win.loadURL(`file://${__dirname}/assets/logs.html`)

    })
}