#!/bin/bash
mysqldump -u root -p --no-data mcscop | sed -e 's/AUTO_INCREMENT=[0-9][0-9]*//' > mcscop-schema.sql
