import * as ftp from "basic-ftp";

import config from "./config"
import { file } from "nconf";
 


function getDirRecursive (client, path) {

    return new Promise((resolutionFunc, rejectionFunc) => {

        let open = 0;

        let allFiles = [];

        async function getDir (path: string) {
            console.log("getdir", path);
            open++;

            let fileList = await client.list(path);

            for (const file of fileList) {
                
                if (file.isDirectory) {
                    await getDir(path + "/" + file.name);
                } else if (file.isFile){
                    allFiles.push({
                        filepath: path + "/" + file.name,
                        size: file.size,
                        modifiedAt: file.modifiedAt
                    });
                }
            }

            open--;
            if (open === 0) {
                resolutionFunc(allFiles);
            }

        }

        getDir(path);

    });

}
 
export default async function (updateTrayIcon: {(status: string)}) {

    const client = new ftp.Client()
    client.ftp.verbose = true
    
    const auth = config.get("authFtpServer");
    
    try {
    
        await client.access({
            ...auth,
            secure: true
        });

        let compareFolders = [
            {
                server: "/public/uploads",
                local: ""
            }
        ]

        getDirRecursive(client, "/public/uploads")
        .then(fileList => {


            getDirRecursive(client, "/storage/uploads/files")
            .then(fileList => {
                

                getDirRecursive(client, "/storage/uploads/images")
                .then(fileList => {
                    console.log(fileList);
                    client.close()
                });

            });

        });

        

        // let fileList = await client.list("/public/uploads");
        // console.log(fileList.map(e => `${e.name} - ${e.size} - ${e.rawModifiedAt}`))
    
    }
    catch(err) {
        updateTrayIcon("sync-problem");
        console.log(err)
    }

} 

// ftp://bookstack/storage/uploads/ -> ./data/bookstack/www/files, images
// ftp://bookstack/public/uploads/ -> ./data/bookstack/www/uploads

// ignore: .gitignore, .htaccess