echo 'Building main...'
browserify public/js/main.js --standalone main > public/js/main-bundle.js
echo 'Building config...'
browserify public/js/config.js --standalone config | uglifyjs > public/js/config-bundle.js
echo 'Building cop...'
browserify public/js/cop.js -i jsdom -i canvas -i xmldom --standalone cop | uglifyjs > public/js/cop-bundle.js
