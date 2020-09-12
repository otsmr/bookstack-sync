#!/bin/bash

if [ "$EUID" -ne 0 ]
  then echo "Bitte als root starten"
  exit
fi

mkdir -p /opt/bookstack-sync
mkdir -p /opt/bookstack-sync/data

cp -r ./* /opt/bookstack-sync/

chmod +x /opt/bookstack-sync/BookStack-Sync.AppImage

cp shortcut/bookstack-sync.desktop /usr/share/applications/


if ! command -v mysql &> /dev/null
then
    apt install mariadb-client-10.3 mariadb-server-10.3
fi

if ! command -v docker-compose &> /dev/null
then
    echo "Bitte installieren Sie manuell Docker"  
    echo "$ curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "$ sh get-docker.sh"
    exit
fi

cd /opt/bookstack-sync
docker-compose up -d