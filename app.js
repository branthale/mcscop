// cop fqdn.  Don't include http, https, etc.
var url = 'www.ironrain.org'
// enable content security policy (this requires url to be set!)
var cspEnabled = false;
// mysql settings
var mysqlOptions = {
    host : 'localhost',
    user : 'mcscop',
    password : 'MCScoppass123!@#',
    database: 'mcscop',
};

var express = require('express');
var fs = require('fs');
var app = express();
var multer = require('multer');
var ShareDB = require('sharedb');
var richText = require('rich-text');
var WebSocketJSONStream = require('websocket-json-stream');
var http = require('http').Server(app);
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var xssFilters = require('xss-filters');
var cookieParser = require('cookie-parser');
var bcrypt = require('bcrypt-nodejs');
var bodyParser = require('body-parser');
var mysql = require('mysql');
var wss = require('ws');
var async = require('async');
var path = require('path');
var crypto = require('crypto');
var sessionStore = new MySQLStore(mysqlOptions);
var sessionMiddleware = session({
    key: 'session',
    secret: 'ProtectxorTheCybxors',
    name: 'session',
    resave: true,
    saveUninitialized: true,
    store: sessionStore
});
var rooms = new Map();
var connection;
var ws = new wss.Server({server:http});
var upload = multer({dest: './temp_uploads'});

Array.prototype.move = function (old_index, new_index) {
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this;
};

var cop_permissions = ['all', 'manage_missions', 'delete_missions', 'manage_users', 'manage_roles'];
var mission_permissions = ['all', 'manage_users', 'modify_diagram', 'create_events', 'delete_events', 'modify_notes', 'create_opnotes', 'delete_opnotes', 'modify_files'];

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sessionMiddleware);
if (cspEnabled) {
    app.use(function(req, res, next) {
        res.setHeader("Content-Security-Policy", "connect-src 'self' wss://" + url + " ws://" + url + "; worker-src 'self' https://" + url + " blob:; default-src 'unsafe-inline' 'unsafe-eval' 'self'; img-src 'self' data: blob:;");
        return next();
    });
}

function handleMySqlConnection() {
    connection = mysql.createConnection(mysqlOptions);
    connection.connect(function(err) {
        if(err) {
            console.log('Error connecting to MySql server:', err);
            setTimeout(handleMySqlConnection, 5000);
        }
    });
    connection.on('error', function(err) {
        console.log('MySql error:', err);
        if(err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'PROTOCOL_PACKETS_OUT_OF_ORDER') {
            handleMySqlConnection();
        } else {
            throw err;
        }
    });
}

handleMySqlConnection();

var db = require('sharedb-mongo')('mongodb://localhost:27017/mcscop');
ShareDB.types.register(richText.type);
var backend = new ShareDB({db: db, disableDocAction: true, disableSpaceDelimitedActions: true});

function sendToRoom(room, msg, selfSocket, roleFilter) {
    if (!selfSocket)
        selfSocket = null;
    if (rooms.get(room)) {
        rooms.get(room).forEach((socket) => {
            if (socket && socket.readyState === socket.OPEN) {
                if (roleFilter && socket.sub_roles.indexOf(roleFilter) !== -1 && socket !== selfSocket) {
                    socket.send(msg); 
                } else if (socket !== selfSocket) {
                    socket.send(msg);
                }
            }
        });
    }
}

function hasPermission(permissions, permission) {
    if (permissions !== undefined && (permissions.split(',').indexOf(permission) > -1 || permissions.split(',').indexOf('all') > -1))
        return true;
    return false;
}

function getDir(dir, mission, cb) {
    var resp = new Array();
    if (dir === path.join(__dirname + '/mission-files/mission-' + mission)) {
        fs.stat(dir, function (err, s) {
            if (err == null) {
            } else if (err.code == 'ENOENT') {
                fs.mkdir(dir,function(err){
                    if(err)
                        console.log(err);
               });
            } else {
                console.log(err);
            }
        });
        resp.push({
            "id": '/',
            "text": '/',
            "icon" : 'jstree-custom-folder',
            "state": {
                "opened": true,
                "disabled": false,
                "selected": false
            },
            "li_attr": {
                "base": '#',
                "isLeaf": false
            },
            "a_attr": {
                "class": 'droppable'
            },
            "children": null
        });
    }
    fs.readdir(dir, function(err, list) {
        if (list) {
            var children = new Array();
            list.sort(function(a, b) {
                return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
            }).forEach(function(file, key) {
                children.push(processNode(dir, mission, file));
            });
            if (dir === path.join(__dirname + '/mission-files/mission-' + mission)) {
                resp[0].children = children;
                cb(resp);
            } else
                cb(children);
        } else {
            cb([]);
        }
    });
}

function processNode(dir, mission, f) {
    var s = fs.statSync(path.join(dir, f));
    var base = path.join(dir, f);
    var rel = path.relative(path.join(__dirname, '/mission-files/mission-' + mission), base);
    return {
        "id": rel,
        "text": f,
        "icon" : s.isDirectory() ? 'jstree-custom-folder' : 'jstree-custom-file',
        "state": {
            "opened": false,
            "disabled": false,
            "selected": false
        },
        "li_attr": {
            "base": rel,
            "isLeaf": !s.isDirectory()
        },
        "a_attr": {
            "class": (s.isDirectory() ? 'droppable' : '')
        },
        "children": s.isDirectory()
    };
}

function insertLogEvent(socket, message, channel) {
    if (!channel || channel === '')
        channel = 'log';
    var analyst = socket.user_id;
    var timestamp = (new Date).getTime();
    connection.query('INSERT INTO log (mission, channel, text, analyst, timestamp) values (?, ?, ?, ?, ?)', [socket.mission, channel, message, analyst, timestamp]);
    sendToRoom(socket.room, JSON.stringify({act:'chat', arg:{messages:[{analyst: socket.username, user_id: socket.user_id, channel: channel, text: message, timestamp: timestamp}]}}));
}

ws.on('connection', function(socket, req) {
    socket.loggedin = false;
    socket.session = '';
    socket.mission = 0;
    session = req.headers.cookie.split('session=s%3A')[1].split('.')[0];
    if (session) {
        socket.session = session;
        connection.query('SELECT data FROM sessions WHERE session_id = ? LIMIT 1', [session], function(err, rows, fields) {
            if (!err) {
                try {
                    data = JSON.parse(rows[0].data);
                    socket.loggedin = data.loggedin;
                    socket.user_id = data.user_id;
                    socket.username = data.username;
                    socket.role = data.role;
                    socket.cop_permissions = data.cop_permissions;
                    socket.mission_permissions = data.mission_permissions;
                    socket.mission_role = data.mission_role;
                    socket.sub_roles = data.sub_roles;
                } catch (e) {
                }
            } else
                console.log(err);
        });
    }
    socket.on('message', function(msg, flags) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            return;
        }
        if (socket.loggedin && msg.act) {
            switch (msg.act) {
                case 'stream':
                    var stream = new WebSocketJSONStream(socket);
                    backend.listen(stream);
                    break;
                case 'join':
                    socket.room = msg.arg.mission;
                    socket.mission = msg.arg.mission;
                    if (!rooms.get(msg.arg.mission))
                        rooms.set(msg.arg.mission, new Set());
                    rooms.get(msg.arg.mission).add(socket);
                    break;
                // ------------------------- CHATS -------------------------
                case 'insert_chat':
                    msg.arg.analyst = socket.username;
                    msg.arg.user_id = socket.user_id;
                    msg.arg.text = xssFilters.inHTMLData(msg.arg.text);
                    msg.arg.timestamp = (new Date).getTime();
                    connection.query('INSERT INTO log (mission, analyst, channel, text, timestamp) values (?, ?, ?, ?, ?)', [socket.mission, socket.user_id, msg.arg.channel, msg.arg.text, msg.arg.timestamp], function (err, results) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act:'chat', arg:{messages:[msg.arg]}}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'get_old_chats':
                    if (msg.arg.start_from !== undefined && !isNaN(msg.arg.start_from)) {
                        connection.query('SELECT * FROM (SELECT true AS prepend, analyst AS user_id, (SELECT username FROM users WHERE deleted = 0 AND users.id = analyst) AS analyst, channel, text, timestamp FROM log WHERE deleted = 0 AND mission = ? AND channel = ? AND timestamp < ? ORDER BY timestamp DESC LIMIT 50) tmp ORDER BY timestamp DESC', [socket.mission, msg.arg.channel, parseInt(msg.arg.start_from)], function(err, rows, fields) {
                            if (rows && rows.length == 50) {
                                if (msg.arg.start_from !== undefined && !isNaN(msg.arg.start_from))
                                    rows[49].more = 1;
                                else
                                    rows[0].more = 1;
                            }
                            if (!err) {
                                socket.send(JSON.stringify({act:'bulk_chat', arg:{messages:rows}}));
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'get_all_chats':
                    var res = [];
                    connection.query('SELECT DISTINCT(channel) FROM log WHERE deleted = 0 AND mission = ?', [socket.mission], function(err, channels, fields) {
                        if (!err) {
                            async.each(channels, function(channel, callback) {
                                connection.query('SELECT * FROM (SELECT analyst as user_id, (SELECT username FROM users WHERE deleted = 0 AND users.id = analyst) AS analyst, channel, text, timestamp FROM log WHERE deleted = 0 AND mission = ? AND channel = ? ORDER BY timestamp DESC LIMIT 50) tmp ORDER BY timestamp ASC', [socket.mission, channel.channel], function(err, rows, fields) {
                                    if (rows && rows.length == 50) {
                                        if (msg.arg.start_from !== undefined && !isNaN(msg.arg.start_from))
                                            rows[49].more = 1;
                                        else
                                            rows[0].more = 1;
                                    }
                                    if (!err) {
                                        res = res.concat(rows);
                                        callback();
                                    } else
                                        console.log(err);
                                });
                            }, function(err) {
                                if (!err)
                                    socket.send(JSON.stringify({act:'bulk_chat', arg:{messages:res}}));
                            });
                        }
                    });
                    break;
                // ------------------------- ROLES -------------------------
                case 'get_roles':
                    connection.query('SELECT id, name FROM roles', [], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_roles', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                // ------------------------- USERS -------------------------
                case 'get_users':
                    connection.query('SELECT id, username, (SELECT role FROM mission_users_rel WHERE user_id = users.id AND mission = ? LIMIT 1) AS role, (SELECT permissions FROM mission_users_rel WHERE user_id = users.id AND mission = ? LIMIT 1) AS permissions FROM users WHERE deleted = 0', [socket.mission, socket.mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_users', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'update_user':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'manage_users')) {
                        var user = msg.arg;
                        if (user.id) {
                            user.permissions = xssFilters.inHTMLData(user.permissions);
                            user.username = xssFilters.inHTMLData(user.username);
                            if (user.role === '')
                                user.role = null;
                            connection.query('SELECT id FROM mission_users_rel WHERE mission = ? AND user_id = ?', [socket.mission, user.id], function(err, rows, fields) {
                                if (rows.length > 0) {
                                    connection.query('UPDATE mission_users_rel SET role = ?, permissions = ? WHERE id = ?', [user.role, user.permissions, rows[0].id], function (err, results) {
                                        if (!err) {
                                            sendToRoom(socket.room, JSON.stringify({act: 'update_user', arg: user}), socket);
                                            insertLogEvent(socket, 'Modified user ID: ' + user.id + '.');
                                        } else
                                            console.log(err);
                                    });
                                } else {
                                    connection.query('INSERT INTO mission_users_rel (user_id, mission, role, permissions) VALUES (?, ?, ?, ?)', [user.id, socket.mission, user.role, user.permissions], function (err, results) {
                                        if (!err) {
                                            sendToRoom(socket.room, JSON.stringify({act: 'update_user', arg: user}), socket);
                                            insertLogEvent(socket, 'Modified user ID: ' + user.id + '.');
                                        } else
                                            console.log(err);
                                    });
                                }
                            });
                        }
                    }
                    break;
                // ------------------------- NOTES -------------------------
                case 'get_notes':
                    var analyst = socket.user_id;
                    var query = 'SELECT id, name FROM notes WHERE deleted = 0 AND mission = ? ORDER BY name ASC'
                    var args = [socket.mission];
                    connection.query(query, args, function(err, rows, fields) {
                        if (!err) {
                            var resp = new Array();
                            for (var i = 0; i < rows.length; i++) {
                                resp.push({
                                    "id": rows[i].id,
                                    "text": rows[i].name,
                                    "icon" : 'jstree-custom-file',
                                    "state": {
                                        "opened": false,
                                        "disabled": false,
                                        "selected": false
                                    },
                                    "li_attr": {
                                        "base": '#',
                                        "isLeaf": true
                                    },
                                    "children": false
                                });
                            }
                            socket.send(JSON.stringify({act:'all_notes', arg:resp}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var evt = msg.arg;
                        if (evt.name) {
                            evt.name = xssFilters.inHTMLData(evt.name);
                            evt.analyst = socket.user_id;
                            connection.query('INSERT INTO notes (mission, name) values (?, ?)', [socket.mission, evt.name], function (err, results) {
                                if (!err) {
                                    insertLogEvent(socket, 'Created note: ' + evt.name + '.');
                                    sendToRoom(socket.room, JSON.stringify({act: 'insert_note', arg: {
                                        "id": results.insertId,
                                        "text": evt.name,
                                        "icon" : 'jstree-custom-file',
                                        "state": {
                                            "opened": false,
                                            "disabled": false,
                                            "selected": false
                                        },
                                        "li_attr": {
                                            "base": '#',
                                            "isLeaf": true
                                        },
                                        "children": false
                                    }}));
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;
                case 'rename_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var evt = msg.arg;
                        if (evt.name) {
                            evt.name = xssFilters.inHTMLData(evt.name);
                            evt.analyst = socket.user_id;
                            connection.query('UPDATE notes SET name = ? WHERE id = ?', [evt.name, evt.id], function (err, results) {
                                if (!err) {
                                    insertLogEvent(socket, 'Renamed note: ' + evt.name + '.');
                                    sendToRoom(socket.room, JSON.stringify({act: 'rename_note', arg: {
                                        id: evt.id,
                                        name: evt.name
                                    }}));
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;

                case 'delete_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var evt = msg.arg;
                        if (!evt.id || isNaN(evt.id) || evt.id === '')
                            evt.id = 0;
                        connection.query('UPDATE notes SET deleted = 1 WHERE id = ?', [evt.id], function (err, results) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted note: ' + evt.id + '.');
                                    sendToRoom(socket.room, JSON.stringify({act: 'delete_note', arg: evt}));
                            } else
                                console.log(err);
                        });
                    }
                    break;
                // ------------------------- EVENTS -------------------------
                case 'get_events':
                    connection.query('SELECT id, event_time, discovery_time, event_type, source_object, source_port, dest_object, dest_port, short_desc, (SELECT username FROM users WHERE users.id = analyst) as analyst, assignment FROM events WHERE deleted = 0 AND mission = ? ORDER BY event_time ASC', [socket.mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_events', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'update_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_events')) {
                        var evt = msg.arg;
                        if (!evt.event_time || isNaN(evt.event_time) || evt.event_time === '')
                            evt.event_time = (new Date).getTime();
                        if (!evt.discovery_time || isNaN(evt.discovery_time) || evt.discovery_time === '')
                            evt.discovery_time = (new Date).getTime();
                        if (!evt.dest_port || isNaN(evt.dest_port) || evt.dest_port === '')
                            evt.dest_port = 0;
                        if (!evt.source_port || isNaN(evt.source_port) || evt.source_port === '')
                            evt.source_port = 0;
                        if (!evt.assignment || isNaN(evt.assignment) || evt.assignment === '')
                            evt.assignment = 0;
                        evt.event_type = xssFilters.inHTMLData(evt.event_type);
                        evt.short_desc = xssFilters.inHTMLData(evt.short_desc);
                        connection.query('UPDATE events SET event_time = ?, discovery_time = ?, source_object = ?, source_port = ?, dest_object = ?, dest_port = ?, event_type = ?, short_desc = ?, assignment = ? WHERE id = ?', [evt.event_time, evt.discovery_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.assignment, evt.id], function (err, results) {
                            if (!err) {
                                insertLogEvent(socket, 'Modified event: ' + evt.event_type + ' ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'update_event', arg: evt}), socket);
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'insert_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_events')) {
                        var evt = msg.arg;
                        if (!evt.event_time || isNaN(evt.event_time) || evt.event_time === '')
                            evt.event_time = (new Date).getTime();
                        if (!evt.discovery_time || isNaN(evt.discovery_time) || evt.discovery_time === '')
                            evt.discovery_time = (new Date).getTime();
                        if (!evt.dest_port || isNaN(evt.dest_port) || evt.dest_port === '')
                            evt.dest_port = 0;
                        if (!evt.source_port || isNaN(evt.source_port) || evt.source_port === '')
                            evt.source_port = 0;
                        if (!evt.assignment || isNaN(evt.assignment) || evt.assignment === '')
                            evt.assignment = 0;
                        evt.event_type = xssFilters.inHTMLData(evt.event_type);
                        evt.short_desc = xssFilters.inHTMLData(evt.short_desc);
                        evt.analyst = socket.user_id;
                        connection.query('INSERT INTO events (mission, event_time, discovery_time, source_object, source_port, dest_object, dest_port, event_type, short_desc, analyst, assignment) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [socket.mission, evt.event_time, evt.discovery_time, evt.source_object, evt.source_port, evt.dest_object, evt.dest_port, evt.event_type, evt.short_desc, evt.analyst, evt.assignment], function (err, results) {
                            if (!err) {
                                evt.id = results.insertId;
                                evt.analyst = socket.username;
                                insertLogEvent(socket, 'Created event: ' + evt.event_type + ' ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'insert_event', arg: evt}));
                            } else
                                console.log(err);
                        });
                    }
                    break; 
                case 'delete_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'delete_events')) {
                        var evt = msg.arg;
                        if (!evt.id || isNaN(evt.id) || evt.id === '')
                            evt.id = 0;
                        connection.query('UPDATE events SET deleted = 1 WHERE id = ?', [evt.id], function (err, results) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted event ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'delete_event', arg: msg.arg}), socket);
                            } else
                                console.log(err);
                        });
                    }
                    break;
                // ------------------------- OPNOTES -------------------------
                case 'get_opnotes':
                    var analyst = socket.user_id;
                    var query = 'SELECT id, event_time, event, source_object, tool, action, (SELECT username FROM users WHERE deleted = 0 AND users.id = analyst) as analyst FROM opnotes WHERE deleted = 0 AND mission = ? AND (analyst = ? OR role IN (?)) ORDER BY event_time ASC'
                    var args = [socket.mission, analyst, socket.sub_roles];
                    if (socket.sub_roles.length === 0) {
                        query = 'SELECT id, event_time, event, source_object, tool, action, (SELECT username FROM users WHERE deleted = 0 AND users.id = analyst) as analyst FROM opnotes WHERE deleted = 0 AND mission = ? ORDER BY event_time ASC';
                        args = [socket.mission, analyst];
                    }
                    connection.query(query, args, function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_opnotes', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'update_opnote':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_opnotes')) {
                        var evt = msg.arg;
                        if (!evt.event || isNaN(evt.event) || evt.event === '')
                            evt.event = 0;
                        if (!evt.event_time || isNaN(evt.event_time) || evt.event === '')
                            evt.event_time = (new Date).getTime();
                        evt.source_object = xssFilters.inHTMLData(evt.source_object);
                        evt.tool = xssFilters.inHTMLData(evt.tool);
                        evt.action = xssFilters.inHTMLData(evt.action);
                        connection.query('UPDATE opnotes SET event_time = ?, event = ?, source_object = ?, tool = ?, action = ? WHERE id = ?', [evt.event_time, evt.event, evt.source_object, evt.tool, evt.action, evt.id], function (err, results) {
                            if (!err) {
                                evt.analyst = socket.username;
                                insertLogEvent(socket, 'Modified opnote: ' + evt.action + ' ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'update_opnote', arg: evt}), socket, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'insert_opnote':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_opnotes')) {
                        var evt = msg.arg;
                        evt.analyst = socket.user_id;
                        if (!evt.event || isNaN(evt.event) || evt.event === '')
                            evt.event = 0;
                        if (!evt.event_time || isNaN(evt.event_time) || evt.event === '')
                            evt.event_time = (new Date).getTime();
                        evt.source_object = xssFilters.inHTMLData(evt.source_object);
                        evt.tool = xssFilters.inHTMLData(evt.tool);
                        evt.action = xssFilters.inHTMLData(evt.action);
                        connection.query('INSERT INTO opnotes (mission, event, role, event_time, source_object, tool, action, analyst) values (?, ?, ?, ?, ?, ?, ?, ?)', [socket.mission, evt.event, socket.mission_role[socket.mission], evt.event_time, evt.source_object, evt.tool, evt.action, socket.user_id], function (err, results) {
                            if (!err) {
                                evt.id = results.insertId; 
                                evt.analyst = socket.username; 
                                insertLogEvent(socket, 'Created opnote: ' + evt.action + ' ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'insert_opnote', arg: evt}), null, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;
                case 'delete_opnote':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'delete_opnotes')) {
                        var evt = msg.arg;
                        if (!evt.id || isNaN(evt.id) || evt.id === '')
                            evt.id = -1;
                        connection.query('UPDATE opnotes SET deleted = 1 WHERE id = ?', [evt.id], function (err, results) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted opnote ID: ' + evt.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'delete_opnote', arg: evt}), socket, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;
                // ------------------------- OBJECTS -------------------------
                case 'get_objects':
                    connection.query('SELECT * FROM objects WHERE deleted = 0 AND mission = ? ORDER BY z ASC', [socket.mission], function(err, rows, fields) {
                        if (!err) {
                            socket.send(JSON.stringify({act:'all_objects', arg:rows}));
                        } else
                            console.log(err);
                    });
                    break;
                case 'insert_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;
                        if (!o.image || o.image === '') {
                            socket.send(JSON.stringify({act: 'error', arg: 'Error: Missing image!'}));
                            break;
                        }
                        if (o.type === 'icon' || o.type === 'shape') {
                            connection.query('SELECT count(*) AS z FROM objects WHERE deleted = 0 AND mission = ?', [socket.mission], function (err, results) {
                                o.z = results[0].z;
                                var x = 33;
                                var y = 33;
                                if (!isNaN(parseFloat(o.x)) && isFinite(o.x) && !isNaN(parseFloat(o.y)) && isFinite(o.y)) {
                                    x = o.x;
                                    y = o.y;
                                }
                                var scale_x = 1;
                                var scale_y = 1;
                                var rot = 0;
                                if (o.type === 'shape') {
                                    scale_x = 65;
                                    scale_y = 65;
                                }
                                o.type = xssFilters.inHTMLData(o.type);
                                o.name = xssFilters.inHTMLData(o.name);
                                o.fill_color = xssFilters.inHTMLData(o.fill_color);
                                o.stroke_color = xssFilters.inHTMLData(o.stroke_color);
                                o.image = xssFilters.inHTMLData(o.image);
                                connection.query('INSERT INTO objects (mission, type, name, fill_color, stroke_color, image, scale_x, scale_y, rot, x, y, z, locked) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [socket.mission, o.type, o.name, o.fill_color, o.stroke_color, o.image, scale_x, scale_y, rot, x, y, o.z, o.locked], function (err, results) {
                                    if (!err) {
                                        o.id = results.insertId;
                                        connection.query('SELECT * FROM objects WHERE deleted = 0 AND id = ?', [o.id], function(err, rows, fields) {
                                            if (!err) {
                                                insertLogEvent(socket, 'Created object: ' + o.name + '.');
                                                sendToRoom(socket.room, JSON.stringify({act: 'insert_object', arg:rows[0]}));
                                            } else
                                                console.log(err);
                                        });
                                    } else
                                        console.log(err);
                                });
                            });
                        } else if (o.type === 'link') {
                            o.type = xssFilters.inHTMLData(o.type);
                            o.name = xssFilters.inHTMLData(o.name);
                            o.fill_color = xssFilters.inHTMLData(o.fill_color);
                            o.stroke_color = xssFilters.inHTMLData(o.stroke_color);
                            o.image = xssFilters.inHTMLData(o.image);
                            o.z = 0;
                            connection.query('INSERT INTO objects ( mission, type, name, stroke_color, image, obj_a, obj_b, z, locked) values (?, ?, ?, ?, ?, ?, ?, ?, 1)', [socket.mission, o.type, o.name, o.stroke_color, o.image, o.obj_a, o.obj_b, 99], function (err, results) {
                                if (!err) {
                                    o.id = results.insertId;
                                        // move new links to back
                                        connection.query('SELECT id FROM objects WHERE deleted = 0 AND mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                            var zs = [];
                                            for (var i = 0; i < results.length; i++)
                                                zs.push(results[i].id);
                                            if (o.z !== zs.indexOf(o.id)) {
                                                zs.move(zs.indexOf(o.id), o.z);
                                                async.forEachOf(zs, function(item, index, callback) {
                                                    connection.query('UPDATE objects SET z = ? WHERE id = ?', [index, item], function (err, results) {
                                                        if (err)
                                                            console.log(err);
                                                        callback();
                                                    });
                                                }, function(err) {
                                                    insertLogEvent(socket, 'Created link: ' + o.name + '.');
                                                    sendToRoom(socket.room, JSON.stringify({act: 'insert_object', arg:o}));
                                                });
                                            }
                                    });
                                } else {
                                    console.log(err);
                                    socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                }
                            });
                        }
                    }
                    break;
                case 'delete_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;
                        if (o.type && o.id) {
                            if (o.type === 'icon' || o.type === 'shape') {
                                connection.query('UPDATE objects SET deleted = 1 WHERE id = ?', [o.id], function (err, results) {
                                    if (!err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:o.id}));
                                        connection.query('SELECT id FROM objects WHERE deleted = 0 AND (obj_a = ? OR obj_b = ?)', [o.id, o.id], function(err, rows, results) {
                                            if (!err) {
                                                async.each(rows, function(row, callback) {
                                                    connection.query('UPDATE objects SET deleted = 1 WHERE id = ?', [row.id], function(err, results) {
                                                        if (err) {
                                                            console.log(err);
                                                            socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                        } else {
                                                            insertLogEvent(socket, 'Deleted object: ' + o.name + '.');
                                                            sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:row.id}));
                                                        }
                                                    });
                                                }, function() {
                                                    connection.query('SELECT id FROM objects WHERE deleted = 0 AND mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                                        for (var i = 0; i < results.length; i++) {
                                                            connection.query('UPDATE objects SET z = ? WHERE id = ?', [i, results[i].id], function (err, results) {
                                                                if (err) {
                                                                    console.log(err);
                                                                    socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                                }
                                                            });
                                                        }
                                                    });
                                                });
                                            } else
                                                console.log(err);
                                        });
                                    } else
                                        console.log(err);
                                });
                            } else if (o.type === 'link') {
                                connection.query('UPDATE objects SET deleted = 1 WHERE id = ?', [o.id], function (err, results) {
                                    if (!err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg: o.id}));
                                        connection.query('SELECT id FROM objects WHERE deleted = 0 AND mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                            if (!err) {
                                                insertLogEvent(socket, 'Deleted link: ' + o.name + '.');
                                                for (var i = 0; i < results.length; i++) {
                                                    connection.query('UPDATE objects SET z = ? WHERE id = ?', [i, results[i].id], function (err, results) {
                                                        if (err) {
                                                            console.log(err);
                                                            socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                                        }
                                                    });
                                                }
                                            } else {
                                                console.log(err);
                                                socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                            }
                                        });
                                    } else {
                                        console.log(err);
                                        socket.send(JSON.stringify({act: 'error', arg: 'Error: ' + err}));
                                    }
                                });
                            }
                        }
                    }
                    break;
                case 'change_object':
                    var o = msg.arg;
                    o.name = xssFilters.inHTMLData(o.name);
                    o.fill_color = xssFilters.inHTMLData(o.fill_color);
                    o.stroke_color = xssFilters.inHTMLData(o.stroke_color);
                    o.image = xssFilters.inHTMLData(o.image);
                    if (o.type !== undefined && hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        if (o.type === 'icon' || o.type === 'shape') {
                            connection.query('UPDATE objects SET name = ?, fill_color = ?, stroke_color = ?, image = ?, locked = ? WHERE id = ?', [o.name, o.fill_color, o.stroke_color, o.image, o.locked, o.id], function (err, results) {
                                if (!err) {
                                    insertLogEvent(socket, 'Modified object: ' + o.name + ' ID: ' + o.id + '.');
                                    sendToRoom(socket.room, JSON.stringify({act: 'change_object', arg: msg.arg}));
                                } else
                                    console.log(err);
                            });
                        } else if (o.type === 'link') {
                            connection.query('UPDATE objects SET name = ?, stroke_color = ? WHERE id = ?', [o.name, o.stroke_color, o.id], function (err, results) {
                                if (!err) {
                                    insertLogEvent(socket, 'Modified link: ' + o.name + ' ID: ' + o.id + '.');
                                    sendToRoom(socket.room, JSON.stringify({act: 'change_object', arg: msg.arg}));
                                } else
                                    console.log(err);
                            });
                        }
                    }
                    break;
                case 'move_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        if (msg.arg.length === 1 && msg.arg[0].z !== undefined) {
                            var o = msg.arg[0];
                            o.z = Math.floor(o.z);
                            connection.query('SELECT id FROM objects WHERE deleted = 0 AND mission = ? ORDER BY z ASC', [socket.mission], function (err, results) {
                                var zs = [];
                                for (var i = 0; i < results.length; i++)
                                    zs.push(results[i].id);
                                if (o.z !== zs.indexOf(o.id)) {
                                    zs.move(zs.indexOf(o.id), o.z);
                                    async.forEachOf(zs, function(item, index, callback) {
                                        connection.query('UPDATE objects SET z = ? WHERE id = ?', [index, item], function (err, results) {
                                            if (err)
                                                console.log(err);
                                            callback();
                                        });
                                    }, function(err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                                    });
                                }
                            });
                        } else {
                            var args = [];
                            async.eachOf(msg.arg, function(o, index, callback) {
                                if (o.type !== undefined && (o.type === 'icon' || o.type === 'shape')) {
                                    o.x = Math.round(o.x);
                                    o.y = Math.round(o.y);
                                    connection.query('UPDATE objects SET x = ?, y = ?, scale_x = ?, scale_y = ?, rot = ? WHERE id = ?', [o.x, o.y, o.scale_x, o.scale_y, o.rot, o.id], function (err, results) {
                                        if (!err) {
                                            args.push(o);
                                        } else
                                            console.log(err);
                                        callback();
                                    });
                                }
                            }, function (err) {
                                if (err)
                                    console.log(err);
                                else
                                    sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: args}), socket);
                            });
                        }
                    }
                    break;
                case 'change_link':
                    var o = msg.arg;
                    if (o.type !== undefined && o.type === 'link') {
                    }
                    break;
            }
            if (msg.msgId !== undefined) {
                socket.send(JSON.stringify({act: 'ack', arg: msg.msgId}));
            }
        }
    });
});

app.get('/', function (req, res) {
    if (req.session.loggedin) {
            res.render('index', { title: 'MCSCOP', permissions: req.session.cop_permissions});
    } else {
       res.redirect('login');
    }
});

app.get('/logout', function (req, res) {
    req.session.destroy();
    res.redirect('login');
});

app.get('/getroles', function (req, res) {
    if (!req.session.loggedin) {
        res.end('ERR');
        return;
    }
    var sel = '<select class="tableselect">';
    connection.query("SELECT id, name FROM roles", function(err, rows, fields) {
        for (var i = 0; i < rows.length; i++)
            sel += '<option value="' + rows[i].id + '">' + rows[i].name + '</option>';
        sel += '</select>';
        res.end(sel);
    });
});

app.post('/api/alert', function(req, res) {
    msg = {};
    mission = req.body.mission;
    msg.user_id = 0;
    msg.analyst = '';
    msg.channel = req.body.channel;
    msg.text = xssFilters.inHTMLData(req.body.text);
    msg.timestamp = (new Date).getTime();
    connection.query('SELECT id, username FROM users WHERE api = ? LIMIT 1', [req.body.api], function(err, rows, fields) {
        if (!err && rows.length > 0) {
            msg.user_id = rows[0].id;
            msg.analyst = rows[0].username;
            connection.query('INSERT INTO log (mission, analyst, channel, text, timestamp) values (?, ?, ?, ?, ?)', [mission, msg.user_id, msg.channel, msg.text, msg.timestamp], function (err, results) {
                if (!err) {
                    sendToRoom(mission, JSON.stringify({act:'chat', arg:{messages:[msg]}}));
                    res.end('OK');
                } else {
                    console.log(err);
                    res.end('ERR');
                }
            });
        } else {
            console.log(err);
            res.end('ERR');
        }
    });
    
});

app.post('/api/:table', function (req, res) {
    if (!req.session.loggedin) {
        res.end('ERR');
        return;
    }
    res.writeHead(200, {"Content-Type": "application/json"});
// MISSIONS
    if (req.params.table !== undefined && req.params.table === 'missions') {
        if (req.body.oper === undefined) {
            connection.query("SELECT id, name, start_date, (SELECT username FROM users WHERE deleted = 0 AND users.id = analyst) as analyst, (SELECT permissions FROM mission_users_rel WHERE user_id = ? AND mission = missions.id LIMIT 1) as permissions FROM missions WHERE deleted = 0 HAVING permissions IS NOT NULL OR 1 = ?", [req.session.user_id, req.session.user_id], function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.oper === 'edit' && hasPermission(req.session.cop_permissions, 'manage_missions') && req.body.id && req.body.name && req.body.start_date) {
            if (req.body.analyst === undefined || req.body.analyst === '')
                req.body.analyst = req.session.user_id;
            connection.query('UPDATE missions SET name = ?, start_date = ?, analyst = ? WHERE id = ?', [req.body.name, req.body.start_date, req.body.analyst, req.body.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR'));
                }
            });
        } else if (req.body.oper === 'add' && hasPermission(req.session.cop_permissions, 'manage_missions') && req.body.name && req.body.start_date) {
            if (req.body.analyst === undefined)
                req.body.analyst = req.session.user_id;
            connection.query('INSERT INTO missions (name, start_date, analyst) values (?, ?, ?)', [req.body.name, req.body.start_date, req.body.analyst], function (err, results) {
                if (!err) {
                    var i =  results.insertId;
                    connection.query('INSERT INTO mission_users_rel (user_id, mission, permissions) values (?, ?, ?)', [req.session.user_id, i, 'all'], function (err, results) {
                        if (req.session.user_id !== 1)
                            connection.query('INSERT INTO mission_users_rel (user_id, mission, permissions) values (?, ?, ?)', [1, i, 'all']); // make sure admin gets all perms
                        res.end(JSON.stringify('OK'));
                    });
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR'));
                }
            });
        } else if (req.body.oper === 'del' && hasPermission(req.session.cop_permissions, 'delete_missions') && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            connection.query('UPDATE missions SET deleted = 1 WHERE id = ?', [id], function (err, results) {
                if (!err) {
                    connection.query('UPDATE objects SET deleted = 1 WHERE mission = ?', [id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        }
                    });
                } else
                    console.log(err);
            });
        }
// USERS
    } else if (req.params.table !== undefined && req.params.table === 'users' && hasPermission(req.session.cop_permissions, 'manage_users')) {
        if (req.body.oper === undefined) {
            connection.query("SELECT id, username, name, '********' as password, avatar, permissions FROM users WHERE deleted = 0", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.oper !== undefined && req.body.oper === 'edit' && req.body.name !== undefined && req.body.id) {
            if (req.body.id === '1')
                req.body.permissions = 'all'; // make sure admin always has all permissions
            else {
                if (req.body.role === undefined || req.body.role === '')
                    req.body.role = null;
                var new_perms = [];
                req.body.permissions = req.body.permissions.split(',');
                for (var i = 0; i < req.body.permissions.length; i++) {
                    if (cop_permissions.indexOf(req.body.permissions[i]) > -1)
                        new_perms.push(req.body.permissions[i]);
                }
                req.body.permissions = new_perms.join(',');
            }
            if (req.body.password !== '********') {
                bcrypt.hash(req.body.password, null, null, function(err, hash) {
                    connection.query('UPDATE users SET name = ?, password = ?, permissions = ? WHERE id = ?', [req.body.name, hash, req.body.permissions, req.body.id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        }
                    });
                });
            } else {
                var query = 'UPDATE users SET name = ?, permissions = ? WHERE id = ?';
                var args = [req.body.name, req.body.permissions, req.body.id];
                connection.query(query, args, function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        res.end(JSON.stringify('ERR'));
                        console.log(err);
                    }
                });
            }
        } else if (req.body.oper !== undefined && req.body.oper === 'add' && req.body.username && req.body.name !== undefined) {
            bcrypt.hash(req.body.password, null, null, function(err, hash) {
                if (req.body.role === undefined || req.body.role === '')
                    req.body.role = null;
                if (req.body.permissions === undefined || req.body.permissions === '')
                    req.body.permissions = null;
                var api = crypto.randomBytes(32).toString('hex'); 
                connection.query('INSERT INTO users (username, name, password, permissions, api) values (?, ?, ?, ?, ?)', [req.body.username, req.body.name, hash, req.body.permissions, api], function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        res.end(JSON.stringify('ERR'));
                        console.log(err);
                    }
                });
            });
        } else if (req.body.oper !== undefined && req.body.oper === 'del' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            if (req.body.id === 1) // don't delete admin
                res.end(JSON.stringify('ERR'));
            else {
                if (id != 0) {
                    connection.query('UPDATE users SET deleted = 1 WHERE id = ?', [id], function (err, results) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            console.log(err);
                            res.end(JSON.stringify('ERR'));
                        }
                    });
                }
            }
        } else {
            res.end(JSON.stringify('ERR'));
        }
// ROLES
    } else if (req.params.table !== undefined && req.params.table === 'roles' && hasPermission(req.session.cop_permissions, 'manage_roles')) {
        if (req.body.oper === undefined) {
            connection.query("SELECT r.id, r.name, (SELECT GROUP_CONCAT(name) FROM roles WHERE id in (SELECT sub_role_id FROM sub_role_rel WHERE sub_role_rel.role_id = r.id)) as sub_roles FROM roles AS r", function(err, rows, fields) {
                if (!err) {
                    res.end(JSON.stringify(rows));
                } else {
                    res.end(JSON.stringify('[]'));
                    console.log(err);
                }
            });
        } else if (req.body.oper !== undefined && req.body.oper === 'edit' && req.body.name && req.body.id) {
            connection.query('UPDATE roles SET name = ? WHERE id = ?', [req.body.name, req.body.id], function (err, results) {
                if (!err) {
                    if (!req.body.sub_roles)
                        req.body.sub_roles = '';
                    var sub_roles = [];
                    req.body.sub_roles = req.body.sub_roles.split(',');
                    for (var i = 0; i < req.body.sub_roles.length; i++) {
                        if (!isNaN(req.body.sub_roles[i])  && req.body.sub_roles[i] !== '')
                            sub_roles.push(parseInt(req.body.sub_roles[i]));
                    }
                    connection.query('SELECT id, sub_role_id FROM sub_role_rel WHERE role_id = ?', [req.body.id], function (err, results) {
                        if (err) {
                            res.end(JSON.stringify('ERR'));
                            console.log(err);
                        } else {
                            var curr_roles = [];
                            for (var j = 0; j < results.length; j++) {
                                curr_roles.push(results[j].sub_role_id);
                            }
                            var additions = sub_roles.filter(x => curr_roles.indexOf(x) < 0 );
                            var subtractions = curr_roles.filter(x => sub_roles.indexOf(x) < 0 );
                            if (subtractions.length === 0)
                                subtractions = '';
                            connection.query('DELETE FROM sub_role_rel WHERE role_id = ? AND sub_role_id IN (?)', [req.body.id, subtractions], function (err, results) {
                                if (err) {
                                    console.log(err);
                                    res.end(JSON.stringify('ERR'));
                                } else {
                                    if (additions.length === 0)
                                        res.end(JSON.stringify('OK'));
                                    else {
                                        for (i = 0; i < additions.length; i++) {
                                            connection.query('INSERT INTO sub_role_rel (role_id, sub_role_id) values (?, ?)', [req.body.id, additions[i]], function (err, results) {
                                                if (err) {
                                                    res.end(JSON.stringify('ERR'));
                                                    console.log(err);
                                                } else if (i === additions.length) {
                                                    res.end(JSON.stringify('OK'));
                                                }
                                            });
                                        }
                                    }
                                }
                            });
                        }
                    });
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        } else if (req.body.oper !== undefined && req.body.oper === 'add' && req.body.name) {
            connection.query('INSERT INTO roles (name) values (?)', [req.body.name], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        } else if (req.body.oper !== undefined && req.body.oper === 'del' && req.body.id !== undefined) {
            var id = JSON.parse(req.body.id);
            if (id != 0) {
                connection.query('DELETE FROM roles WHERE id = ?', [id], function (err, results) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        console.log(err);
                        res.end(JSON.stringify('ERR'));
                    }
                });
            }
        }
    } else if (req.params.table !== undefined && req.params.table === 'change_password') {
        bcrypt.hash(req.body.newpass, null, null, function(err, hash) {
            connection.query('UPDATE users SET password = ? WHERE id = ?', [hash, req.session.user_id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        });
    } else {
        res.end(JSON.stringify('ERR'));
    }
});

app.get('/config', function (req, res) {
    var profile = {};
    profile.username = req.session.username;
    profile.name = req.session.name;
    profile.user_id = req.session.user_id;
    profile.permissions = req.session.cop_permissions;
    if (req.session.loggedin) {
        res.render('config', { title: 'MCSCOP', profile: profile, permissions: req.session.cop_permissions});
    } else {
       res.redirect('login');
    }
});

function getPNGs(name) {
    return name.endsWith('.png');
}

app.get('/cop', function (req, res) {
    var icons = [];
    var shapes = [];
    var links = [];
    var mission_role = null;
    var mission_permissions = null;
    if (req.session.loggedin) {
        if (req.query.mission !== undefined && req.query.mission > 0) {
            fs.readdir('./public/images/icons', function(err, icons) {
                fs.readdir('./public/images/shapes', function(err, shapes) {
                    fs.readdir('./public/images/links', function(err, links) {
                        connection.query('SELECT name FROM missions WHERE id = ? LIMIT 1', [req.query.mission], function (err, rows, fields) {
                            if (!err) {
                                var mission_name = rows[0].name;
                                connection.query('SELECT role, permissions FROM mission_users_rel WHERE user_id = ? AND mission = ?', [req.session.user_id, req.query.mission], function (err, rows, fields) {
                                    if (!err && rows.length > 0) {
                                        mission_role = rows[0].role;
                                        mission_permissions = rows[0].permissions;
                                    }
                                    if (req.session.user_id === 1)
                                        mission_permissions = 'all'; //admin has all permissions
                                    req.session.mission_role[req.query.mission] = mission_role;
                                    req.session.mission_permissions[req.query.mission] = mission_permissions;
                                    if (req.session.user_id === 1 || (mission_permissions && mission_permissions !== '')) // always let admin in
                                        res.render('cop', { title: 'MCSCOP - ' + mission_name, role: mission_role, permissions: mission_permissions, mission_name: mission_name, user_id: req.session.user_id, username: req.session.username, icons: icons.filter(getPNGs), shapes: shapes.filter(getPNGs), links: links.filter(getPNGs)});
                                    else
                                        res.redirect('login');
                                });
                            } else {
                                console.log(err);
                                res.redirect('login');
                            }
                        });
                    });
                });
            });
        } else {
            res.redirect('../');
        }
    } else {
       res.redirect('login');
    }
});

app.post('/login', function (req, res) {
    if (req.body.username !== undefined && req.body.username !== '' && req.body.password !== undefined && req.body.password !== '') {
        connection.query('SELECT id, username, name, password, permissions FROM users WHERE deleted = 0 AND username = ?', [req.body.username], function (err, rows, fields) {
            if (!err) {
                if (rows.length === 1) {
                    bcrypt.compare(req.body.password, rows[0].password, function(err, bres) {
                        if (bres) {
                            req.session.user_id = rows[0].id;
                            req.session.name = rows[0].name;
                            req.session.username = rows[0].username;
                            req.session.loggedin = true;
                            req.session.role = rows[0].role;
                            req.session.sub_roles = [];
                            req.session.cop_permissions = rows[0].permissions;
                            req.session.mission_permissions = {};
                            req.session.mission_role = {};
                            req.session.mission_sub_roles = {};
//                            connection.query('SELECT sub_role_id FROM sub_role_rel WHERE role_id = ?', [rows[0].role], function (err, rows, fields) {
  //                               if (!err) {
    //                                for (var i = 0; i < rows.length; i++) {
      //                                  req.session.sub_roles.push(rows[i].sub_role_id);
        //                            }
          //                      }
                                res.redirect('login');
            //                });
                        } else
                            res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
                    });
                } else {
                    console.log(err);
                    res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
                }
            }
        });
    } else {
        res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
    }
});

app.get('/login', function (req, res) {
    if (req.session.loggedin)
        res.redirect('.');
    else
        res.render('login', { title: 'MCSCOP Login' });
});


// --------------------------------------- FILES ------------------------------------------

app.post('/dir/', function (req, res) {
    if (!req.session.loggedin) {
        res.end('ERR');
        return;
    }
    var dir = req.body.id;
    var mission = req.body.mission;
    if (dir && mission && dir !== '#') {
        dir = path.normalize(dir).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(__dirname + '/mission-files/mission-' + mission, dir);
        var s = fs.statSync(dir);
        if (s.isDirectory()) {
            getDir(dir, mission, function(r) {
                res.send(r);
            })
        } else {
            res.status(404).send('Not found');
        }
    } else if (dir && mission) {
        dir = path.join(__dirname, '/mission-files/mission-' + mission);
        getDir(dir, mission, function(r) {
            res.send(r);
        });
    }
});

app.use('/download', express.static(path.join(__dirname, 'mission-files'), {
    etag: false,
    setHeaders: function(res, path) {
        res.attachment(path);
    }

}))

app.post('/mkdir', function (req, res) {
    if (!req.session.loggedin || !hasPermission(req.session.mission_permissions[req.body.mission], 'modify_files')) {
        res.end('ERR');
        return;
    }
    var id = req.body.id;
    var name = req.body.name;
    var mission = req.body.mission;
    if (id && name && mission) {
        var dir = path.normalize(id).replace(/^(\.\.[\/\\])+/, '');
        name = path.normalize('/' + name + '/').replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(path.join(path.join(__dirname, '/mission-files/mission-' + mission + '/'), dir), name);
        fs.stat(dir, function (err, s) {
            if (err == null)
                res.status(500).send('mkdir error');
            else if (err.code == 'ENOENT') {
                fs.mkdir(dir,function(err){
                    if(err)
                        res.status(500).send('mkdir error');
                    else {
                        res.send('{}');
                        sendToRoom(req.body.mission, JSON.stringify({act: 'update_files', arg: null}));
                    }
               });
            } else {
                res.status(500).send('mkdir error');
            }
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/mv', function (req, res) {
    if (!req.session.loggedin || !hasPermission(req.session.mission_permissions[req.body.mission], 'modify_files')) {
        res.end('ERR');
        return;
    }
    var dst = req.body.dst;
    var src = req.body.src;
    var mission = req.body.mission;
    if (dst && src && mission) {
        var dstdir = path.normalize(dst).replace(/^(\.\.[\/\\])+/, '');
        var srcdir = path.normalize(src).replace(/^(\.\.[\/\\])+/, '');
        dstdir = path.join(path.join(__dirname, '/mission-files/mission-' + mission), dstdir);
        srcdir = path.join(path.join(__dirname, '/mission-files/mission-' + mission), srcdir);
        fs.stat(dstdir, function (err, s) {
            if (s.isDirectory()) {
                fs.stat(srcdir, function (err, s) {
                    if (s.isDirectory() || s.isFile()) {
                        fs.rename(srcdir, dstdir + '/' + path.basename(srcdir), function(err) {
                            if (err)
                                res.status(500).send('mv error');
                            else {
                                res.send('{}');
                                sendToRoom(req.body.mission, JSON.stringify({act: 'update_files', arg: null}));
                            }
                        });
                    } else
                        res.status(500).send('mv error');
                });
            } else
                res.status(500).send('mv error');
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/delete', function (req, res) {
    if (!req.session.loggedin || !hasPermission(req.session.mission_permissions[req.body.mission], 'modify_files')) {
        res.end('ERR');
        return;
    }
    var id = req.body.id;
    var mission = req.body.mission;
    if (id) {
        var dir = path.normalize(id).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(path.join(__dirname, '/mission-files/mission-' + mission + '/'), dir);
        fs.stat(dir, function (err, s) {
            if (err)
                res.status(500).send('delete error');
            if (s.isDirectory()) {
                fs.rmdir(dir,function(err){
                    if(err)
                        res.status(500).send('delete error');
                    else {
                        res.send('{}');
                        sendToRoom(req.body.mission, JSON.stringify({act: 'update_files', arg: null}));
                    }
               });
            } else {
                fs.unlink(dir,function(err){
                    if(err)
                        res.status(500).send('delete error');
                    else {
                        res.send('{}');
                        sendToRoom(req.body.mission, JSON.stringify({act: 'update_files', arg: null}));
                    }
               });
            }
        });
    } else
        res.status(404).send('Y U bein wierd?');
});

app.post('/upload', upload.any(), function (req, res) {
    if (!req.session.loggedin || !hasPermission(req.session.mission_permissions[req.body.mission], 'modify_files')) {
        res.end('ERR');
        return;
    }
    if (req.body.dir && req.body.dir.indexOf('_anchor') && req.body.mission) {
        var dir = req.body.dir.substring(0,req.body.dir.indexOf('_anchor'));
        dir = path.normalize(dir).replace(/^(\.\.[\/\\])+/, '');
        dir = path.join(__dirname + '/mission-files/mission-' + req.body.mission + '/', dir);
        async.each(req.files, function(file, callback) {
            fs.rename(file.path, dir + '/' + file.originalname, function(err) {
                if (err)
                    res.status(500).send('upload error');
                else
                    callback();
            });
        }, function() {
            res.send('{}');
            sendToRoom(req.body.mission, JSON.stringify({act: 'update_files', arg: null}));
        });
    } else
       res.status(404).send('Y U bein wierd?');
});

app.post('/avatar', upload.any(), function (req, res) {
    if (!req.session.loggedin || (!hasPermission(req.session.cop_permissions, 'modify_users') && req.session.user_id !== parseInt(req.body.id))) {
        res.end('ERR');
        return;
    }
    if (req.body.id && !isNaN(req.body.id)) {
        var dir = path.join(__dirname + '/public/images/avatars/');
        async.each(req.files, function(file, callback) {
            fs.rename(file.path, dir + '/' + req.body.id + '.png', function(err) {
                if (err)
                    res.status(500).send('upload error');
                else
                    callback();
            });
        }, function() {
            connection.query('UPDATE users SET avatar = ? WHERE id = ?', [req.body.id + '.png', req.body.id], function (err, results) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR'));
                    console.log(err);
                }
            });
        });
    } else
       res.status(404).send('Y U bein wierd?');
});

app.get("/images/avatars/*", function(req, res, next) {
    res.sendFile(path.join(__dirname, 'public/images/avatars/default.png'));
});

// -------------------------------------------------------------------------

http.listen(3000, function () {
    console.log('Server listening on port 3000!');
});
