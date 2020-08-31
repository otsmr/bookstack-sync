import { execSync } from "child_process";

import * as path from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";
import moment from "moment";
import mysql from "mysql2/promise";


let config: any = {};

try {

    config = JSON.parse(readFileSync("../config.json").toString());

} catch (error) {

    console.log(error.toString());
    process.exit(1);
    
}


async function loadMetaData (auth) {

    const connection = await mysql.createConnection({
        ...auth,
        database: "information_schema"
    });

    const [ rows ] = await connection.execute("SELECT `TABLE_NAME`, `TABLE_ROWS`, `CREATE_TIME`, `UPDATE_TIME` FROM `TABLES` WHERE `TABLE_SCHEMA` = ?", [auth.database]);

    return rows

}

function createBackup (auth: { host: string; user: string; password: string; port: string; database: string; }) {

    const backupFolder = path.join(config.backuppath, moment().format("YYYY"), moment().format("MM"), moment().format("DD"));
    mkdirSync(backupFolder, { recursive: true })

    const backupFilePath = path.join(backupFolder, moment().format("HH.mm.ss") +  ` - datenbank ${auth.host}.sql`);

    console.log(backupFilePath);

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

    if (!createBackup(auth)) {
        return false;
    };

    // const mysql_output = execSync(`mysql -u${auth.user} -p${auth.password} -P ${auth.port} -h ${auth.host} ${auth.database} < mysqldump.backup2.sql`).toString();

}

(async ()=>{


    try {

        const server = config.authMysqlServer;
        const client = config.authMysqlClient;
    
    
        // createBackup(client);
        await loadMetaData(client);
    
    
        
    } catch (error) {
    
        console.log(error.toString());
        // console.warn("Das folgende Packet muss installiert sein: sudo apt install mariadb-client-10.3");
        process.exit(1);
        
    }



})()





// ftp://bookstack/storage/uploads/ -> ./data/bookstack/www/
// ftp://bookstack/public/uploads/ -> ./data/bookstack/www/uploads