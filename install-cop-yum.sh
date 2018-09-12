#!/bin/sh
if [ $EUID -ne 0 ] || [ "$SUDO_USER" == "root" ]; then
   echo "[!] This script must be run with sudo from the user that will run the cop."
   exit 1
fi
echo "[*] This script installs the required packages to run MCSCOP"
echo "    The following packages will be installed: curl, mongodb,"
echo "    nodejs, and npm."
echo "    You may be prompted to provide your sudo or root password."
echo ""
while true; do
    read -p "[!] Do you need to install or update packages and dependicies? " yn
    case $yn in
        [Yy]* ) ans=1; break;;
        [Nn]* ) ans=0; break;;
        * ) echo "[!] Please select yes or no.";;
    esac
done
if [ $ans -eq 1 ]; then
    cp mongodb-org-3.6.repo /etc/yum.repos.d
    yum -y install curl mongodb-org
    curl -sL https://rpm.nodesource.com/setup_8.x | bash -
    yum -y install nodejs
    systemctl enable mongod.service
    systemctl start mongod.service
    npm install
fi
echo ""
echo "[*] Creating initial admin.  Please provide a password for the"
echo "    default admin user."
echo ""
while true; do
    read -s -p "Password: " pass
    echo ""
    read -s -p "Confirm password: " cpass
    echo ""
    if [ $pass == $cpass ]; then
        node support.js $pass
        break;
    fi
    echo "[!] Passwords do not match, please try again."
done
echo ""
while true; do
    read -p "[!] Do you want to enable pm2 persistence for the cop? " yn
    case $yn in
        [Yy]* ) ans=1; break;;
        [Nn]* ) ans=0; break;;
        * ) echo "[!] Please select yes or no.";;
    esac
done
if [ $ans -eq 1 ]; then
    npm install -g pm2
    env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER
    su $SUDO_USER -c "pm2 start app.js --name=MCSCOP; pm2 save"
fi
echo ""
echo "[!] Installation complete. The intial credentials are admin and "
echo "    the password you set above."
echo "    If you used pm2 persistence, the cop can be accessed by visiting"
echo "    http://<this machine's ip>:3000"
echo ""
echo "    If you did not use pm2 persistance, the cop service can be"
echo "    started by issuing the command 'node app.js' from this directory"
echo "    as the user you wish the cop to run as."
echo ""
