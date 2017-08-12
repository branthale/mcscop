# mcscop

## Installation
```bash
git clone https://github.com/psmitty7373/mcscop.git
cd mcscop/
./install.sh
node app.js
```

## Getting Started with Docker

```bash
cd mcscop/
docker build -t mcscop .
docker run --name mcscop --rm -p 3000:3000 mcscop
```

This maps the container's 3000/tcp with your 0.0.0.0:3000/tcp. Open up your browser to http://localhost:3000
