import { app } from "electron";
import open from 'open';
import nconf from "nconf";
import fs, { mkdirSync } from "fs";
import path from "path";

const defaultConfigPath = path.join(__dirname, "../config.json");

const appdata = path.join(path.normalize(app.getPath("appData")), "bookstack-sync");
mkdirSync(appdata, { recursive: true });

export default new class {

    configPath: string = path.join(appdata, "config.json");

    constructor () {

        let defaultConfigs = {};
        try { defaultConfigs = JSON.parse(fs.readFileSync(defaultConfigPath).toString()); } catch (error) { }

        if (!fs.existsSync(this.configPath)) {
            fs.writeFileSync(this.configPath, JSON.stringify(defaultConfigs, null, 4));
            open(this.configPath);
        }

        fs.watchFile(this.configPath, function (curr, prev) {

            if (curr.mtime !== prev.mtime) {
                app.relaunch();
                app.exit();
            }

        });
        
        nconf.file("file", {
            file: this.configPath
        });

    }


    get (param) {
        return nconf.get(param);
    }

}