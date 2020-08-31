import { execSync } from "child_process";
import * as path from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";

import moment from "moment";
import mysql from "mysql2/promise";
import Zip from "adm-zip";

import config from "./config"


function zipFile (filepath: string) {

    try {

        const zip = new Zip();
        zip.addLocalFile(filepath);
    
        zip.writeZip(filepath + ".zip");
    
        unlinkSync(filepath);
        
    } catch (error) {

        console.log(error);
        
    }

}

function askByCount () {
    console.log("ASK BY COUNT CHANGE");

}

async function compareMysqlServers () {

    const localInfos = await loadMetaData(config.get("authMysqlLocal"));
    const serverInfos = await loadMetaData(config.get("authMysqlServer"));

    const checktablesByTime = config.get("checktables:bytime");
    const askbycountchanged = config.get("checktables:askbycountchanged");


    let newerIn = "equal";

    for (let i = 0; i < localInfos.length; i++) {

        let linfo = localInfos[i];
        let sinfo = serverInfos[i];

        if (linfo.tableName !== sinfo.tableName) continue;

        if (askbycountchanged.indexOf(sinfo.tableName) > -1) {

            if (sinfo.count !== linfo.count) {
                askByCount();
                return "error";
            }

        }

        if (checktablesByTime.indexOf(sinfo.tableName) > -1) {

            if (linfo.lastUpdate === sinfo.lastUpdate) continue;

            let table_newerIn = "equal";

            if (linfo.lastUpdate < sinfo.lastUpdate && linfo.count <= sinfo.count) {
                table_newerIn = "server"
                
            } else if (linfo.lastUpdate > sinfo.lastUpdate && linfo.count >= sinfo.count) {
                table_newerIn = "local"
            } else {
                askByCount();
                return "error";
            }

            if (table_newerIn === "equal") continue;
            if (newerIn !== "equal" && table_newerIn !== newerIn) {
                return "error";
            }

            console.log(linfo.tableName, table_newerIn, linfo.lastUpdate, sinfo.lastUpdate);
            newerIn = table_newerIn;

        }

    }

    // return "error";
    return newerIn;

}

interface Compares {
    tableName: string,
    lastUpdate: string | null,
    count: number | null
}

async function loadMetaData (auth): Promise<(Compares[])> {

    const connInfoSchema = await mysql.createConnection({
        ...auth,
        database: "information_schema"
    });

    const connDatabase = await mysql.createConnection({
        ...auth,
        database: auth.database
    });


    const [ rows ] = await connInfoSchema.execute("SELECT `TABLE_NAME`, `TABLE_ROWS`, `CREATE_TIME`, `UPDATE_TIME` FROM `TABLES` WHERE `TABLE_SCHEMA` = ? ORDER by TABLE_NAME", [auth.database]);
        

    const checktablesByTime = config.get("checktables:bytime");
    const askbycountchanged = config.get("checktables:askbycountchanged");

    let compares: Compares[] = [];

    for (const row of rows) {

        let lastUpdate = null;
        let count = null;

        if (checktablesByTime.indexOf(row.TABLE_NAME) > -1) {

            let [ byTimesRows ] = await connDatabase.execute("SELECT * FROM `"+row.TABLE_NAME+"` ORDER by updated_at desc LIMIT 1");

            if (byTimesRows.length === 1) {
                lastUpdate = +new Date(byTimesRows[0]["updated_at"]);
            }

            let [ countRows ] = await connDatabase.execute("SELECT COUNT(*) FROM " + row.TABLE_NAME);
            count = countRows[0]["COUNT(*)"];
        
        } else if (askbycountchanged.indexOf(row.TABLE_NAME) > -1) {

            let [ countRows ] = await connDatabase.execute("SELECT COUNT(*) FROM " + row.TABLE_NAME);
            count = countRows[0]["COUNT(*)"];

        }

        compares.push({
            tableName: row.TABLE_NAME,
            lastUpdate,
            count
        });

    }

    connInfoSchema.end();
    connDatabase.end();

    return compares;

}

function createBackup (auth: { host: string; user: string; password: string; port: string; database: string; }) {

    const backupFolder = path.join(config.get("backupPath"), moment().format("YYYY"), moment().format("MM"), moment().format("DD"));
    mkdirSync(backupFolder, { recursive: true })

    const backupFilePath = path.join(backupFolder, moment().format("HH.mm.ss") +  ` - datenbank ${auth.host}.sql`);

    try {

        execSync(`mysqldump -u${auth.user} -p${auth.password} -P ${auth.port} -h ${auth.host} ${auth.database} > "${backupFilePath}"`).toString();
        
    } catch (error) {
        console.log(error.toString());
        return null;
    }


    return backupFilePath;

}

function updateDatabase (auth, restoreFile) {

    if (!existsSync(restoreFile)) return false;

    let backup = createBackup(auth);

    if (!backup) {
        return false;
    };

    zipFile(backup);

    try {
        execSync(`mysql -u${auth.user} -p${auth.password} -P ${auth.port} -h ${auth.host} ${auth.database} < "${restoreFile}"`).toString();
        
    } catch (error) {
        console.log(error.toString());
        return false;
    }
    
    zipFile(restoreFile);
    return true;

}

export default async function (call: {(status: string): void}) {

    try {
    
        const newerIn = await compareMysqlServers();

        if (newerIn === "error") throw new Error("Datenbanken koennen nicht syncronisiert werden.");
        else if (newerIn === "equal") console.log("Datenbanken sind aktuell");
        else {

            let serverIsOlder = (newerIn === "local") ? true : false;

            if (serverIsOlder) call("sync-up");
            else call("sync-down");

            console.log((serverIsOlder) ? "Server" : "Lokal", "wird aktualisiert.");

            let downloadedFile = await createBackup((serverIsOlder) ? config.get("authMysqlLocal") : config.get("authMysqlServer"));

            updateDatabase((serverIsOlder) ? config.get("authMysqlServer") : config.get("authMysqlLocal"), downloadedFile);

        }

        call("book-check");
    
    } catch (error) {
    
        console.log(error);
        
        call("sync-problem");
        
    }

}