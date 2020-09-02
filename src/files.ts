import * as ftp from "basic-ftp";

import config from "./config"
import recursive from "./readdir"
import { join, dirname } from "path";
import { mkdirSync } from "fs";
 
import log from "./log"

    
const auth = config.get("authFtpServer");

function getDirRecursive (client, path) {

    return new Promise((resolutionFunc, rejectionFunc) => {

        let open = 0;

        let allFiles = [];

        async function getDir (path: string) {
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

async function uploadFilesToServer (client: any, files: {from: string, to: string}[]) {

    for (const file of files) {
        try {
            log.info(`"${file.from}" wird nach "${auth.host}" hochgeladen`);
            await client.uploadFrom(file.from, file.to);
        } catch (error) {
            console.log(error);
        }
    }
    
}
async function downloadFilesFromServer (client: any, files: {from: string, to: string}[]) {

    for (const file of files) {
        try {
            mkdirSync(dirname(file.to), { recursive: true});
            log.info(`"${file.from}" wird von "${auth.host}" heruntergeladen`);
            await client.downloadTo(file.to, file.from);
        } catch (error) {
            console.log(error);
        }
        
    }

}
 
export default async function (updateTrayIcon: {(status: string)}) {

    const client = new ftp.Client()
    client.ftp.verbose = false;
    
    try {
    
        await client.access({
            ...auth,
            secure: true
        });

        let localPath = join(config.get("localBookStackDockerPath"), "www").replace(/\\/g, "/");

        let folders = [
            {
                server: "/public/uploads",
                local: `${localPath}/uploads`
            },
            {
                server: "/storage/uploads/files",
                local: `${localPath}/files`
            },
            {
                server: "/storage/uploads/images",
                local: `${localPath}/images`
            }
        ]

        function compareFolders (id: number) {
            if (!folders[id]) {
                client.close();
                updateTrayIcon("book-check");
                return;
            }

            log.info(`Dateien in "${folders[id].server}" | "${folders[id].local}" werden verglichen`);

            getDirRecursive(client, folders[id].server)
            .then((serverFileList: any[]) => {

                serverFileList = serverFileList.map(e => {return {
                    ...e,
                    filepath: e.filepath.replace(folders[id].server, "")
                }});

                recursive(folders[id].local, async (err, localFileList) => {

                    localFileList = localFileList.map(e => {return {
                        ...e,
                        filepath: e.filepath.replace(/\\/g, "/").replace(folders[id].local, "")
                    }});


                    let downloadFiles = serverFileList.filter(serverfile => {
                        let localfile = localFileList.find(e => e.filepath === serverfile.filepath);
                        if (!localfile) return true;
                        if (localfile.size === serverfile.size) return false;

                        if (+new Date(serverfile.modifiedAt) > +new Date(localfile.modifiedAt)) {
                            return true;
                        }
                        return false;

                    })

                    let uploadFiles = localFileList.filter(localfile => {
                        let serverfile = serverFileList.find(e => e.filepath === localfile.filepath);
                        if (!serverfile) return true;
                        if (localfile.size === serverfile.size) return false;

                        if (+new Date(serverfile.modifiedAt) < +new Date(localfile.modifiedAt)) {
                            return true;
                        }
                        return false;

                    })

                    if (downloadFiles.length > 0) {
                        updateTrayIcon("sync-down");
                        await downloadFilesFromServer(client, downloadFiles.map(e => {return{
                            from: folders[id].server + e.filepath,
                            to: folders[id].local + e.filepath
                        }}));
                    }
                    if (uploadFiles.length > 0) {
                        updateTrayIcon("sync-up");
                        await uploadFilesToServer(client, uploadFiles.map(e => {return{
                            to: folders[id].server + e.filepath,
                            from: folders[id].local + e.filepath
                        }}));
                    }

                    if (uploadFiles.length === 0 && downloadFiles.length === 0) {
                        log.info(`Dateien in "${folders[id].server}" | "${folders[id].local}" sind aktuell`);
                    }

                    compareFolders(id + 1);

                })


            });

        }

        compareFolders(0);
        

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