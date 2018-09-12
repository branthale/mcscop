#!/bin/sh
MONGOFILE=mcscop.mongo.`date +"%Y%m%d"`

mongodump -d mcscop
tar zcvf backups/${MONGOFILE}.tar.gz dump
rm -rf dump
