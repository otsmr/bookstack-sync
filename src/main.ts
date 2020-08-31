
const { execSync } = require("child_process");

const config = require("../config.json");

// FTP-Sync




//  initial download from server


try {

    const auth = config.authMysqlServer;

    const out = execSync(`mysqldump -u ${auth.user} -p"${auth.pass}" -P ${auth.port} -h ${auth.host} ${auth.database} > mysqldump.backup`).toString();
    
} catch (error) {

    console.log(error.toString());
    console.warn("Das folgende Packet muss installiert sein: sudo apt install mariadb-client-10.3");
    process.exit(1);
    
}


// mysqldump -u {mysql_user} -p {database_name} > {output_file_name}


// ftp://bookstack/storage/uploads/ -> ./data/bookstack/www/


// ftp://bookstack/public/uploads/ -> ./data/bookstack/www/uploads