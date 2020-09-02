import { execSync, exec, ExecException } from "child_process";
import * as path from "path";
import { existsSync, mkdirSync, unlinkSync } from "fs";

import moment from "moment";
import mysql from "mysql2/promise";
import Zip from "adm-zip";

import config from "./config"
import { syncProblem } from "./dialogs";
import { updateTrayIcon } from "./electron";
import log from "./log";


function zipFile (filepath: string) {

    try {

        const zip = new Zip();
        zip.addLocalFile(filepath);
        zip.writeZip(filepath + ".zip");
        unlinkSync(filepath);
        
    } catch (error) {
        log.error("Fehler beim erstellen einer ZIP-Datei ("+filepath+".zip): " + error.toString());
    }

}

function askByCount () {

    updateTrayIcon("sync-problem");
    syncProblem((version) => {
        update(version);
    });

}

function compareMysqlServers (call: {(newerIn: string)}) {


    loadMetaData(config.get("authMysqlLocal")).then(localInfos => {

        loadMetaData(config.get("authMysqlServer")).then(serverInfos => {
    
            const checktablesByTime = config.get("checktables:bytime");
            const askbycountchanged = config.get("checktables:askbycountchanged");
        
            let newerIn = "equal";
        
            for (let i = 0; i < localInfos.length; i++) {
        
                let linfo = localInfos[i];
                let sinfo = serverInfos[i];
        
                if (linfo.tableName !== sinfo.tableName) continue;
        
                if (askbycountchanged.indexOf(sinfo.tableName) > -1) {
        
                    if (sinfo.count !== linfo.count) {
                        log.warning("Problem in der Tabelle " +  linfo.tableName + " -> Manuelle Überprüfung erforderlich");
                        askByCount();
                        return;
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
                        return;
                    }
        
                    if (table_newerIn === "equal") continue;

                    updateTrayIcon("sync");

                    if (newerIn !== "equal" && table_newerIn !== newerIn) {
                        log.warning("Problem in der Tabelle " +  linfo.tableName + ", da in " + table_newerIn + " | lokalTime: " + linfo.lastUpdate + " | serverTime: " +  sinfo.lastUpdate);
                        return call("error");
                    }
                    log.info("Tabelle " +  linfo.tableName + " neuer in " + table_newerIn + " | lokalTime: " + linfo.lastUpdate + " | serverTime: " +  sinfo.lastUpdate);
                    newerIn = table_newerIn;
        
                }
        
            }

            call(newerIn);

        })
        
    })


}

interface Compares {
    tableName: string,
    lastUpdate: string | null,
    count: number | null
}

async function loadMetaData (auth: { database: any; }): Promise<(Compares[])> {

    return new Promise(async (resolve, reject) => {

        try {
            
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
    
            resolve(compares);

        } catch (error) {

            log.error("Load Metadata: " + error.toString());
            updateTrayIcon("sync-problem");
            reject();
            
        }


    })

}

function createBackup (auth: { host: string; user: string; password: string; port: string | number; database: string; }, ready: {(err: boolean, backup: string)}) {

    const backupFolder = path.join(config.get("backupPath"), moment().format("YYYY"), moment().format("MM"), moment().format("DD"));
    mkdirSync(backupFolder, { recursive: true })

    const backupFilePath = path.join(backupFolder, moment().format("HH.mm.ss") +  ` - datenbank ${auth.host}.sql`);

    log.info(`Datenbank-Backup von '${auth.host}' wird erstellt`);

    exec(`mysqldump -u${auth.user} -p${auth.password} -P ${auth.port} -h ${auth.host} ${auth.database} > "${backupFilePath}"`, (error: ExecException, stdout: string, stderr: string) => {

        if (error) {
            updateTrayIcon("sync-problem");
            log.error("exec mysqldump: " + stderr);
            return;
        }

        ready(false, backupFilePath);

    })

}

function updateDatabase (auth: { host: string; user: string; password: string; port: string | number; database: string; }, restoreFile: string, ready: {(): void}) {

    if (!existsSync(restoreFile)) return;

    createBackup(auth, (err, backup) => {

        if (err) {
            updateTrayIcon("sync-problem");
            return;
        }

        zipFile(backup);

        log.info(`Datenbank auf '${auth.host}' wird überschrieben`);
    
        exec(`mysql -u${auth.user} -p${auth.password} -P ${auth.port} -h ${auth.host} ${auth.database} < "${restoreFile}"`, (error: ExecException, stdout: string, stderr: string) => {
    
            if (error) {
                updateTrayIcon("sync-problem");
                log.error("exec mysql: " + stderr);
                return;
            }

            zipFile(restoreFile);

            ready();

        })
            

    });


}

function update (newerIn: string, ready: {(): void} = ()=>{}) {

    let serverIsOlder = (newerIn === "local") ? true : false;

    if (serverIsOlder) updateTrayIcon("sync-up");
    else updateTrayIcon("sync-down");

    log.info(((serverIsOlder) ? "Server" : "Lokal") + " wird aktualisiert.");

    createBackup((serverIsOlder) ? config.get("authMysqlLocal") : config.get("authMysqlServer"), (err: boolean, downloadedFile: string) => {

        updateDatabase((serverIsOlder) ? config.get("authMysqlServer") : config.get("authMysqlLocal"), downloadedFile, () => {
            updateTrayIcon("book-check");
            ready();
        });

    });


}

export default function (ready: {(): void}) {

    try {

        compareMysqlServers((newerIn) => {

            if (newerIn === "error") {
                updateTrayIcon("sync-problem");
                syncProblem((version) => {
                    update(version, ready);
                });
            }
            else if (newerIn === "equal") {
                log.info("Datenbanken sind aktuell");
                updateTrayIcon("book-check");
                ready();
            }
            else {
                update(newerIn, ready);
            }

        })
    
    } catch (error) {
    
        log.error("Bei Datenbank-Synchronisierung: " + error.toString());
        updateTrayIcon("sync-problem");
        
    }

}