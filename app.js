// cop fqdn.  Don't include http, https, etc.
const url = 'www.ironrain.org'

// enable content security policy (this requires url to be set!)
const cspEnabled = false;

const express = require('express');
const fs = require('fs');
const app = express();
const multer = require('multer');
const ShareDB = require('sharedb');
const richText = require('rich-text');
const WebSocketJSONStream = require('websocket-json-stream');
const http = require('http').Server(app);
const session = require('express-session');
const xssFilters = require('xss-filters');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt-nodejs');
const bodyParser = require('body-parser');
const wss = require('ws');
const async = require('async');
const path = require('path');
const crypto = require('crypto');
const MongoClient = require('mongodb').MongoClient;
const MongoStore = require('connect-mongo')(session);
const ObjectID = require('mongodb').ObjectID;
const rooms = new Map();
const ws = new wss.Server({server:http});
const upload = multer({dest: './temp_uploads'});

const cop_permissions = ['all', 'manage_missions', 'delete_missions', 'manage_users', 'manage_roles'];
const mission_permissions = ['all', 'manage_users', 'modify_diagram', 'create_events', 'delete_events', 'modify_notes', 'create_opnotes', 'delete_opnotes', 'modify_files', 'api_access'];

app.set('view engine', 'pug');
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'ProtextTheCybxers',
    name: 'session',
    saveUninitialized: true,
    resave: true,
    store: new MongoStore({
        url: 'mongodb://localhost/mcscop',
        host: 'localhost',
        collection: 'sessions',
        autoReconnect: true,
        clear_interval: 3600
    })
}));

if (cspEnabled) {
    app.use(function(req, res, next) {
        res.setHeader("Content-Security-Policy", "connect-src 'self' wss://" + url + " ws://" + url + "; worker-src 'self' https://" + url + " blob:; default-src 'unsafe-inline' 'unsafe-eval' 'self'; img-src 'self' data: blob:;");
        return next();
    });
}

var mdb;

MongoClient.connect('mongodb://localhost/mcscop', function(err, database) {
    if (err) throw err;
    mdb = database;
});

const sdb = require('sharedb-mongo')('mongodb://localhost:27017/mcscop');
ShareDB.types.register(richText.type);
const backend = new ShareDB({sdb: sdb, disableDocAction: true, disableSpaceDelimitedActions: true});

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
    var timestamp = (new Date).getTime();
    var log = { mission_id: ObjectID(socket.mission), user_id: ObjectID(socket.user_id), channel: channel, text: message, timestamp: timestamp, deleted: false };
    mdb.collection('chats').insertOne(log, function (err, result) {
        if (!err) {
            log.username = socket.username;
            sendToRoom(socket.room, JSON.stringify({ act: 'chat', arg: { messages: [ log ] } }));
        } else
            console.log(err);
    });
}

ws.on('connection', function(socket, req) {
    socket.loggedin = false;
    socket.session = '';
    socket.mission = 0;
    var s = req.headers.cookie.split('session=s%3A')[1].split('.')[0];
    if (s) {
        socket.session = s;
        mdb.collection('sessions').findOne({ _id: session }, function(err, row) {
            if (row) {
                try {
                    var data = JSON.parse(row.session);
                    socket.loggedin = data.loggedin;
                    socket.user_id = data.user_id;
                    socket.username = data.username;
                    socket.role = data.role;
                    socket.cop_permissions = data.cop_permissions;
                    socket.mission_permissions = data.mission_permissions;
                    socket.mission_role = data.mission_role;
                    socket.sub_roles = data.sub_roles;
                } catch (e) {
                    console.log(e);
                }
            } else if (err)
                console.log(err);
        });
    }
    socket.on('message', function(msg, flags) {
        try {
            msg = JSON.parse(msg);
        } catch (e) {
            return;
        }

        console.log(msg, socket.type);
        
        if (msg.act && ((msg.act === 'stream' || msg.act === 'join') || (socket.mission && ObjectID.isValid(socket.mission) && socket.user_id && ObjectID.isValid(socket.user_id))) && socket.loggedin) {
            switch (msg.act) {
                case 'stream':
                    var stream = new WebSocketJSONStream(socket);
                    socket.type = 'sharedb';
                    backend.listen(stream);
                    break;

                case 'join':
                    socket.room = msg.arg.mission;
                    socket.mission = msg.arg.mission;
                    if (!rooms.get(msg.arg.mission))
                        rooms.set(msg.arg.mission, new Set());
                    rooms.get(msg.arg.mission).add(socket);
                    socket.type = 'diagram';
                    break;

                // ------------------------- CHATS -------------------------
                case 'insert_chat':
                    msg.arg.username = socket.username;
                    msg.arg.user_id = socket.user_id;
                    msg.arg.text = xssFilters.inHTMLData(msg.arg.text);
                    msg.arg.timestamp = (new Date).getTime();

                    var chat = { mission_id: ObjectID(socket.mission), user_id: ObjectID(socket.user_id), channel: msg.arg.channel, text: msg.arg.text, timestamp: msg.arg.timestamp, deleted: false };
                    mdb.collection('chats').insertOne(chat, function (err, result) {
                        if (!err) {
                            sendToRoom(socket.room, JSON.stringify({act:'chat', arg:{messages:[msg.arg]}}));
                        } else
                            console.log(err);
                    });
        
                    break;

                case 'get_old_chats':
                    if (!msg.arg.start_from || isNaN(msg.arg.start_from) || !msg.arg.channel)
                        break;

                    mdb.collection('chats').aggregate([
                        {
                            $match: { mission_id: ObjectID(socket.mission), channel: msg.arg.channel, timestamp: { $lt: parseInt(msg.arg.start_from) }, deleted: { $ne: true } }
                        },{
                            $sort: { timestamp: -1 }
                        },{
                            $limit: 50
                        },{
                            $lookup: {
                                from: 'users',
                                localField: 'user_id',
                                foreignField: '_id',
                                as: 'username'
                            }
                        },{
                            $project: {
                                _id: 1,
                                user_id: 1,
                                channel: 1,
                                text: 1,
                                timestamp: 1,
                                prepend: 'true',
                                username: '$username.username'
                            }
                    }]).toArray(function(err, rows) {
                        if (rows) {
                            if (rows.length == 50)
                                if (msg.arg.start_from !== undefined && !isNaN(msg.arg.start_from))
                                    rows[49].more = 1;
                                else
                                    rows[0].more = 1;
                            socket.send(JSON.stringify({act:'bulk_chat', arg:{messages:rows}}));
                        } else {
                            socket.send(JSON.stringify({ act: 'bulk_chat', arg: { messages: '[]' } }));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'get_all_chats':
                    var res = [];
                    mdb.collection('chats').distinct('channel', function(err, channels) {
                        if (channels) {
                            async.each(channels, function(channel, callback) {
                                mdb.collection('chats').aggregate([
                                    {
                                        $match: { mission_id: ObjectID(socket.mission), channel: channel, deleted: { $ne: true } }
                                    },{
                                        $sort: { timestamp: -1 }
                                    },{
                                        $limit: 50
                                    },{
                                        $sort: { timestamp: 1 }
                                    },{
                                        $lookup: {
                                            from: 'users',
                                            localField: 'user_id',
                                            foreignField: '_id',
                                            as: 'username'
                                        }
                                    },{
                                        $project: {
                                            _id: 1,
                                            user_id: 1,
                                            channel: 1,
                                            text: 1,
                                            timestamp: 1,
                                            username: '$username.username'
                                        }
                                }]).toArray(function(err, rows) {
                                    if (rows) {
                                        if (rows.length == 50)
                                            if (msg.arg.start_from !== undefined && !isNaN(msg.arg.start_from))
                                                rows[49].more = 1;
                                            else
                                                rows[0].more = 1;
                                        res = res.concat(rows);
                                        callback();
                                    } else {
                                        socket.send(JSON.stringify({ act: 'bulk_chat', arg: { messages: '[]' } }));
                                        if (err)
                                            console.log(err);
                                    }
                                });
                            }, function(err) {
                                if (!err)
                                    socket.send(JSON.stringify({ act:'bulk_chat', arg:{ messages:res } }));
                            });
                        } else {
                                socket.send(JSON.stringify({ act: 'bulk_chat', arg: { messages: '[]' } }));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                // ------------------------- ROLES -------------------------
                case 'get_roles':
                    mdb.collection('roles').find({ deleted: { $ne: true }}).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act: 'all_roles', arg: rows }))
                        } else {
                            socket.send(JSON.stringify({ act: 'all_roles', arg: '[]' }));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                // ------------------------- USERS -------------------------
                case 'get_users':
                    mdb.collection('users').find({ deleted: { $ne: true } }, { username: 1 }).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act: 'all_users', arg: rows }))
                        } else {
                            socket.send(JSON.stringify({ act: 'all_users', arg: '[]' }));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'get_user_settings':
                    mdb.collection('missions').aggregate([
                        {
                            $match: { _id: ObjectID(socket.mission), deleted: { $ne: true } }
                        },{
                            $unwind: '$mission_users'
                        },{
                            $lookup: {
                                from: 'users',
                                localField: 'mission_users.user_id',
                                foreignField: '_id',
                                as: 'user'
                            }
                        },{
                            $project: {
                                _id: '$mission_users._id',
                                user_id: '$mission_users.user_id',
                                username: '$user.username',
                                permissions: '$mission_users.permissions',
                                role: '$mission_users.role'
                            }
                        }
                    ]).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act: 'all_user_settings', arg: rows }));
                        } else {
                            socket.send(JSON.stringify({ act: 'all_user_settings', arg: '[]' }));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;
                case 'insert_user_setting':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'manage_users')) {
                        var user = msg.arg;

                        if (!user.user_id)
                            break;

                        user.permissions = xssFilters.inHTMLData(user.permissions);
                        user.username = xssFilters.inHTMLData(user.username);
                        user.role = xssFilters.inHTMLData(user.role);

                        if (user.permissions === '')
                            user.permissions = null

                        var new_values = { $push: { mission_users: { _id: ObjectID(null), user_id: ObjectID(user.user_id), permissions: user.permissions, role: null } } };
                        
                        if (user.role && ObjectID.isValid(user.role))
                            new_values.$push.mission_users.role = ObjectID(user.role);

                        mdb.collection('missions').count({ _id: ObjectID(socket.mission), 'mission_users.user_id': ObjectID(user.user_id) }, function(err, count) {
                            // don't let the user make the same user setting over again
                            if (count === 0) {
                                mdb.collection('missions').updateOne({ _id: ObjectID(socket.mission) }, new_values, function (err, result) {
                                    if (!err) {
                                        socket.send(JSON.stringify({act: 'insert_user_setting', arg: user}));
                                        insertLogEvent(socket, 'Inserted user setting ID: ' + user.user_id + '.');
                                    } else
                                        console.log(err);
                                });
                            }
                        });
                    }
                    break;

                case 'update_user_setting':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'manage_users')) {
                        var user = msg.arg;

                        if (!ObjectID.isValid(user.user_id))
                            break;

                        user.permissions = xssFilters.inHTMLData(user.permissions);
                        user.username = xssFilters.inHTMLData(user.username);

                        if (user.permissions === '')
                            user.permissions = null

                        var new_values = { $set: { 'mission_users.$.permissions': user.permissions, 'mission_users.$.role': null }  };

                        if (user.role && ObjectID.isValid(user.role))
                            new_values.$set['mission_users.$.role'] = ObjectID(user.role);

                        mdb.collection('missions').updateOne({ _id: ObjectID(socket.mission), 'mission_users.user_id': ObjectID(user.user_id) }, new_values, function (err, result) {
                            if (!err) {
                                socket.send(JSON.stringify({act: 'update_user_setting', arg: user}));
                                insertLogEvent(socket, 'Modified user setting ID: ' + user.user_id + '.');
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'delete_user_setting':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'manage_users')) {
                        var user = msg.arg;

                        if (!ObjectID.isValid(user._id))
                            break;

                        mdb.collection('missions').findOneAndUpdate({ _id: ObjectID(socket.mission) }, { $pull: { mission_users: { _id: ObjectID(user._id) } } }, function (err, result) {
                            if (!err) {
                                sendToRoom(socket.room, JSON.stringify({act: 'delete_user_setting', arg: user}));
                                insertLogEvent(socket, 'Deleted user setting ID: ' + user._id + '.');
                            } else
                                console.log(err);
                        });
                    }
                    break;
                // ------------------------- NOTES -------------------------
                case 'get_notes':
                    var args = [socket.mission];

                    mdb.collection('notes').find({ $and: [ { mission_id: ObjectID(socket.mission) }, { deleted: { $ne: true } } ] }).sort({ name : 1 }).toArray(function(err, rows) {
                        if (rows) {
                            var resp = new Array();
                            for (var i = 0; i < rows.length; i++) {
                                resp.push({
                                    "id": rows[i]._id,
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
                        } else { 
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'insert_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var e = msg.arg;

                        if (!e.name)
                            break;

                        e.name = xssFilters.inHTMLData(e.name);
                        var note = { mission_id: ObjectID(socket.mission), name: e.name, deleted: false };
                        mdb.collection('notes').insertOne(note, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Created note: ' + e.name + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'insert_note', arg: {
                                    "id": note._id,
                                    "text": e.name,
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
                    break;

                case 'rename_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var e = msg.arg;

                        if (!e.name || !ObjectID.isValid(e.id))
                            break;

                        e.name = xssFilters.inHTMLData(e.name);
                        var new_values = { $set: { name: e.name } };
                        mdb.collection('notes').updateOne({ _id: ObjectID(e.id) }, new_values, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Renamed note: ' + e.name + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'rename_note', arg: {
                                    id: e.id,
                                    name: e.name
                                }}));
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'delete_note':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'edit_notes')) {
                        var e = msg.arg;

                        if (!e.id || !ObjectID.isValid(e.id))
                            break;

                        mdb.collection('notes').updateOne({ _id: ObjectID(e.id) }, { $set: { deleted: true } }, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted note: ' + e.id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'delete_note', arg: e}));
                            } else
                                console.log(err);
                        });
                    }
                    break;

                // ------------------------- EVENTS -------------------------
                case 'get_events':
                    mdb.collection('events').aggregate([
                        {
                            $match: { mission_id: ObjectID(socket.mission), deleted: { $ne: true }}
                        },{
                            $sort: { event_time: 1 }
                        },{
                            $lookup: {
                                from: 'users',
                                localField: 'user_id',
                                foreignField: '_id',
                                as: 'username'
                            }
                        },{
                            $project: {
                                _id: 1,
                                mission_id: 1,
                                event_time: 1,
                                discovery_time: 1,
                                event_type: 1,
                                source_object: 1,
                                dest_object: 1,
                                source_port: 1,
                                dest_port: 1,
                                short_desc: 1,
                                assignment: 1,
                                user_id: 1,
                                username: '$username.username'
                            }
                        }
                    ]).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act:'all_events', arg:rows }))
                        } else {
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'update_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_events')) {
                        var e = msg.arg;

                        if (!e._id || !ObjectID.isValid(e._id))
                            break;

                        if (!e.event_time || isNaN(e.event_time) || e.event_time === '')
                            e.event_time = (new Date).getTime();
                        if (!e.discovery_time || isNaN(e.discovery_time) || e.discovery_time === '')
                            e.discovery_time = (new Date).getTime();
                        if (!e.dest_port || isNaN(e.dest_port) || e.dest_port === '')
                            e.dest_port = 0;
                        if (!e.source_port || isNaN(e.source_port) || e.source_port === '')
                            e.source_port = 0;

                        e.event_type = xssFilters.inHTMLData(e.event_type);
                        e.short_desc = xssFilters.inHTMLData(e.short_desc);

                        var new_values = { $set: { event_time: e.event_time, discovery_time: e.discovery_time, source_object: null, source_port: e.source_port, dest_object: null, dest_port: e.dest_port, event_type: e.event_type, short_desc: e.short_desc, assignment: null} };

                        if (e.source_object && ObjectID.isValid(e.source_object))
                            new_values.$set.source_object = ObjectID(e.source_object);
                        if (e.dest_object && ObjectID.isValid(e.dest_object))
                            new_values.$set.dest_object = ObjectID(e.dest_object);
                        if (e.assignment && ObjectID.isValid(e.assignment))
                            new_values.$set.assignment = ObjectID(e.assignment);
    
                        mdb.collection('events').updateOne({ _id: ObjectID(e._id) }, new_values, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Modified event: ' + e.event_type + ' ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'update_event', arg: e}), socket);
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'insert_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_events')) {
                        var e = msg.arg;
                        if (!e.event_time || isNaN(e.event_time) || e.event_time === '')
                            e.event_time = (new Date).getTime();
                        if (!e.discovery_time || isNaN(e.discovery_time) || e.discovery_time === '')
                            e.discovery_time = (new Date).getTime();
                        if (!e.dest_port || isNaN(e.dest_port) || e.dest_port === '')
                            e.dest_port = 0;
                        if (!e.source_port || isNaN(e.source_port) || e.source_port === '')
                            e.source_port = 0;

                        e.event_type = xssFilters.inHTMLData(e.event_type);
                        e.short_desc = xssFilters.inHTMLData(e.short_desc);
                        e.user_id = socket.user_id;
                        e.username = socket.username;

                        var evt = { mission_id: ObjectID(socket.mission), event_time: e.event_time, discovery_time: e.discovery_time, source_object: null, source_port: e.source_port, dest_object: null, dest_port: e.dest_port, event_type: e.event_type, short_desc: e.short_desc, user_id: ObjectID(socket.user_id), deleted: false };

                        if (e.source_object && ObjectID.isValid(e.source_object))
                            evt.source_object = ObjectID(e.source_object);
                        if (e.dest_object && ObjectID.isValid(e.dest_object))
                            evt.dest_object = ObjectID(e.dest_object);
                        if (e.assignment && ObjectID.isValid(e.assignment))
                            evt.assignment = ObjectID(e.assignment);

                        mdb.collection('events').insertOne(evt, function (err, result) {
                            if (!err) {
                                e._id = evt._id;
                                insertLogEvent(socket, 'Created event: ' + e.event_type + ' ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'insert_event', arg: e}));
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'delete_event':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'delete_events')) {
                        var e = msg.arg;
                        if (!e._id || !ObjectID.isValid(e._id))
                            break;

                        mdb.collection('events').updateOne({ _id: ObjectID(e._id) }, { $set: { deleted: true } }, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted event ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({ act: 'delete_event', arg: e }), socket);
                            } else
                                console.log(err);
                        });
                    }
                    break;

                // ------------------------- OPNOTES -------------------------
                case 'get_opnotes':
                    mdb.collection('opnotes').aggregate([
                        {
                            $match: { mission_id: ObjectID(socket.mission), deleted: { $ne: true }}
                        },{
                            $sort: { event_time: 1 }
                        },{
                            $lookup: {
                                from: 'users',
                                localField: 'user_id',
                                foreignField: '_id',
                                as: 'username'
                            },
                        },{
                            $project: {
                                _id: 1,
                                mission_id: 1,
                                evt: 1,
                                event_time: 1,
                                source_object: 1,
                                tool: 1,
                                action: 1,
                                user_id: 1,
                                username: '$username.username'
                            }
                        }
                    ]).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act:'all_opnotes', arg:rows }))
                        } else {
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'update_opnote':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_opnotes')) {
                        var e = msg.arg;

                        if (!e._id || !ObjectID.isValid(e._id))
                            break;

                        e.source_object = xssFilters.inHTMLData(e.source_object);
                        e.tool = xssFilters.inHTMLData(e.tool);
                        e.action = xssFilters.inHTMLData(e.action);

                        var new_values = { $set: { event_time: e.event_time, event_id: null, source_object: e.source_object, tool: e.tool, action: e.action } };

                        if (e.event_id && ObjectID.isValid(e.event_id))
                            new_values.event_id = ObjectID(e.event_id);

                        if (!e.event_time || isNaN(e.event_time) || e.event_time === '')
                            new_values.event_time = (new Date).getTime();

                        mdb.collection('opnotes').updateOne({ _id: ObjectID(e._id) }, new_values, function (err, result) {
                            if (!err) {
                                e.username = socket.username;
                                insertLogEvent(socket, 'Modified opnote: ' + e.action + ' ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'update_opnote', arg: e}), socket, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'insert_opnote':
                    console.log('here');
                    if (hasPermission(socket.mission_permissions[socket.mission], 'create_opnotes')) {
                        var e = msg.arg;

                        e.user_id = socket.user_id;
                        e.source_object = xssFilters.inHTMLData(e.source_object);
                        e.tool = xssFilters.inHTMLData(e.tool);
                        e.action = xssFilters.inHTMLData(e.action);

                        var opnote = { mission_id: ObjectID(socket.mission), event_id: null, role: socket.mission_role[socket.mission], event_time: e.event_time, source_object: e.source_object, tool: e.tool, action: e.action, user_id: ObjectID(e.user_id), deleted: false };

                        if (e.event_id && ObjectID.isValid(e.event_id))
                            e.event_id = ObjectID(e.event_id);

                        if (!e.event_time || isNaN(e.event_time) || e.event === '')
                            e.event_time = (new Date).getTime();

                        mdb.collection('opnotes').insertOne(opnote, function (err, result) {
                            if (!err) {
                                e.id = opnote._id;
                                e.user_id = socket.user_id;
                                e.username = socket.username;
                                insertLogEvent(socket, 'Created opnote: ' + e.action + ' ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'insert_opnote', arg: e}), null, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;

                case 'delete_opnote':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'delete_opnotes')) {
                        var e = msg.arg;
                        if (!e._id || !ObjectID.isValid(e._id))
                            break;

                        mdb.collection('opnotes').updateOne({ _id: ObjectID(e._id) }, { $set: { deleted: true } }, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Deleted opnote ID: ' + e._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'delete_opnote', arg: e}), socket, socket.role);
                            } else
                                console.log(err);
                        });
                    }
                    break;

                // ------------------------- OBJECTS -------------------------
                case 'get_objects':
                    mdb.collection('objects').find({ mission_id: ObjectID(socket.mission), deleted: { $ne: true } }).sort({ z: 1 }).toArray(function(err, rows) {
                        if (rows) {
                            socket.send(JSON.stringify({ act:'all_objects', arg:rows }))
                        } else {
                            socket.send(JSON.stringify('[]'));
                            if (err)
                                console.log(err);
                        }
                    });
                    break;

                case 'paste_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;

                        if (!o._id || !ObjectID.isValid(o._id))
                            break;

                        mdb.collection('objects').findOne({ _id: ObjectID(o._id), deleted: { $ne: true }}, function(err, row) {
                            if  (row) {
                                row._id = ObjectID(null);
                                row.z = o.z;

                                if (isNaN(parseFloat(o.x)) || !isFinite(o.x) || isNaN(parseFloat(o.y)) || !isFinite(o.y)) {
                                    row.x += 20;
                                    row.y += 20;
                                } else {
                                    row.x = o.x;
                                    row.y = o.y;
                                }

                                mdb.collection('objects').insertOne(row, function (err, result) {
                                    if (!err) {
                                        insertLogEvent(socket, 'Created ' + row.type + ': ' + row.name + '.');
                                        sendToRoom(socket.room, JSON.stringify({ act: 'insert_object', arg: row }));
                                    } else
                                        console.log(err);
                                });
                            } else {
                                if (err)
                                    console.log(err);
                            }
                        });
                    }
                    break;

                case 'insert_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;
                        if (o.type === 'link' && (!o.obj_a || !o.obj_b || !ObjectID.isValid(o.obj_a) || !ObjectID.isValid(o.obj_b)))
                            break;

                        if (!o.image || o.image === '') {
                            socket.send(JSON.stringify({act: 'error', arg: 'Error: Missing image!'}));
                            break;
                        }

                        if (o.type === 'icon' || o.type === 'shape' || o.type === 'link') {
                            if (isNaN(parseFloat(o.x)) || !isFinite(o.x) || isNaN(parseFloat(o.y)) || !isFinite(o.y)) {
                                o.x = 33;
                                o.y = 33;
                            }
                            o.rot = 0;
                            o.scale_x = 1;
                            o.scale_y = 1;
                            if (o.type === 'shape') {
                                o.scale_x = 65;
                                o.scale_y = 65;
                            }
                            o.type = xssFilters.inHTMLData(o.type);
                            o.name = xssFilters.inHTMLData(o.name);
                            o.fill_color = xssFilters.inHTMLData(o.fill_color);
                            o.stroke_color = xssFilters.inHTMLData(o.stroke_color);
                            o.image = xssFilters.inHTMLData(o.image);

                            // get object count for new z
                            mdb.collection('objects').count({ mission_id: ObjectID(socket.mission) }, function(err, count) {
                                if (!err) {
                                    var object;
                                    if (o.type === 'icon' || o.type === 'shape')
                                        object = { mission_id: ObjectID(socket.mission), type: o.type, name: o.name, fill_color: o.fill_color, stroke_color: o.stroke_color, image: o.image, scale_x: o.scale_x, scale_y: o.scale_y, rot: o.rot, x: o.x, y: o.y, z: count, locked: o.locked, deleted: false };
                                    else if (o.type === 'link')
                                        object = { mission_id: ObjectID(socket.mission), type: o.type, name: o.name, stroke_color: o.stroke_color, image: o.image, obj_a: ObjectID(o.obj_a), obj_b: ObjectID(o.obj_b), z: 0, locked:o.locked, deleted: false };
                                    // add object to db
                                    mdb.collection('objects').insertOne(object, function (err, result) {
                                        if (!err) {
                                            // if link, push to back
                                            if (o.type === 'link') {
                                                mdb.collection('objects').find({ $and: [ { mission_id: ObjectID(socket.mission) }, { deleted: { $ne: true } } ] }, { _id: 1 }).sort({ z: 1 }).toArray(function(err, rows) {
                                                    var zs = rows.map(r => String(r._id));
                                                    zs.move(zs.indexOf(String(object._id)), 0);
                                                    async.forEachOf(zs, function(item, index, callback) {
                                                        var new_values = { $set: { z: index }};
                                                        mdb.collection('objects').updateOne({ _id: ObjectID(item) }, new_values, function (err, result) {
                                                            if (err)
                                                                console.log(err);
                                                            callback();
                                                        });
                                                    }, function(err) {
                                                        insertLogEvent(socket, 'Created ' + o.type + ': ' + o.name + '.');
                                                        sendToRoom(socket.room, JSON.stringify({ act: 'insert_object', arg: object }));
                                                    });
                                                });
                                            } else {
                                                // push object back to room
                                                insertLogEvent(socket, 'Created ' + o.type + ': ' + o.name + '.');
                                                sendToRoom(socket.room, JSON.stringify({ act: 'insert_object', arg: object }));
                                            }
                                        } else {
                                            console.log(err);
                                        }
                                    });
                                } else {
                                    console.log(err);
                                }
                            });
                        }
                    }
                    break;

                case 'delete_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;
                        if (!o.type || !o._id || !ObjectID.isValid(o._id))
                            break;

                        if (o.type === 'icon' || o.type === 'shape' || o.type == 'link') {
                            var query = {};
                            if (o.type === 'icon' || o.type === 'shape')
                                query = { $or: [ { _id: ObjectID(o._id) }, { obj_a: ObjectID(o._id) }, { obj_b: ObjectID(o._id) } ] };
                            else if (o.type === 'link')
                                query = { _id: ObjectID(o._id) };
                            mdb.collection('objects').find(query, { _id: 1 }).toArray(function(err, rows) {
                                if (!err) {
                                    async.each(rows, function(row, callback) {
                                        mdb.collection('objects').updateOne({ _id: ObjectID(row._id) }, { $set: { deleted: true }}, function (err, result) {
                                            if (!err) {
                                                console.log(row._id);
                                                sendToRoom(socket.room, JSON.stringify({act: 'delete_object', arg:row._id}));
                                            } else
                                                console.log(err);
                                        });
                                    }, function() {
                                        mdb.collection('objects').find({ $and: [ { mission_id: ObjectID(socket.mission) }, { deleted: { $ne: true } } ] }, { _id: 1 }).sort({ z: 1 }).toArray(function(err, rows) {
                                            var zs = rows.map(r => String(r._id));
                                            async.forEachOf(zs, function(item, index, callback) {
                                                var new_values = { $set: { z: index }};
                                                mdb.collection('objects').updateOne({ _id: ObjectID(item) }, new_values, function (err, result) {
                                                    if (err)
                                                        console.log(err);
                                                    callback();
                                                });
                                            });
                                        });
                                    });
                                } else {
                                    console.log(err);
                                }
                            });
                        }
                    }
                    break;

                case 'change_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        var o = msg.arg;
                        
                        if (!o._id || !ObjectID.isValid(o._id) || !o.type)
                            break;

                        o.name = xssFilters.inHTMLData(o.name);
                        o.fill_color = xssFilters.inHTMLData(o.fill_color);
                        o.stroke_color = xssFilters.inHTMLData(o.stroke_color);
                        o.image = xssFilters.inHTMLData(o.image);

                        var new_values = {};
                        if (o.type === 'icon' || o.type === 'shape')
                            new_values = { $set: { name: o.name, fill_color: o.fill_color, stroke_color: o.stroke_color, image: o.image, locked: o.locked }};
                        else if (o.type === 'link')
                            new_values = { $set: { name: o.name, stroke_color: o.stroke_color }};
                        else
                            break;
                        mdb.collection('objects').updateOne({ _id: ObjectID(o._id) }, new_values, function (err, result) {
                            if (!err) {
                                insertLogEvent(socket, 'Modified object: ' + o.name + ' ID: ' + o._id + '.');
                                sendToRoom(socket.room, JSON.stringify({act: 'change_object', arg: msg.arg}));
                            } else {
                                console.log(err);
                            }
                        });
                    }
                    break;

                case 'move_object':
                    if (hasPermission(socket.mission_permissions[socket.mission], 'modify_diagram')) {
                        // move objects (z-axis)
                        if (msg.arg.length === 1 && msg.arg[0].z !== undefined && msg.arg[0]._id && ObjectID.isValid(msg.arg[0]._id)) {
                            var o = msg.arg[0];
                            o.z = Math.floor(o.z);
                            mdb.collection('objects').find({ mission_id: ObjectID(socket.mission), deleted: { $ne: true } }, { _id: 1, z: 1, name: 1 }).sort({ z: 1 }).toArray(function(err, rows) {
                                if (rows) {
                                    var zs = rows.map(r => String(r._id));
                                    zs.move(zs.indexOf(String(o._id)), o.z);
                                    async.forEachOf(zs, function(item, index, callback) {
                                        var new_values = { $set: { z: index }};
                                        mdb.collection('objects').updateOne({ _id: ObjectID(item) }, new_values, function (err, result) {
                                            if (err)
                                                console.log(err);
                                            callback();
                                        });
                                    }, function(err) {
                                        sendToRoom(socket.room, JSON.stringify({act: 'move_object', arg: msg.arg}));
                                    });
                                } else {
                                    if (err)
                                        console.log(err);
                                }
                            });
                        // move objects (x/y axis)
                        } else {
                            var args = [];
                            async.eachOf(msg.arg, function(o, index, callback) {
                                if (o.type !== undefined && (o.type === 'icon' || o.type === 'shape') && ObjectID.isValid(o._id)) {
                                    o.x = Math.round(o.x);
                                    o.y = Math.round(o.y);
                                    var new_values = { $set: { x: o.x, y: o.y, scale_x: o.scale_x, scale_y: o.scale_y, rot: o.rot }};
                                    mdb.collection('objects').updateOne({ _id: ObjectID(o._id) }, new_values, function (err, result) {
                                        if (!err) {
                                            args.push(o);
                                        } else {
                                            console.log(err);
                                        }
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
        res.end('ERR1');
        return;
    }
    var sel = '<select class="tableselect">';
    mdb.collection('roles').find({ deleted: { $ne: true } }, { password: 0 }).toArray(function(err, rows) {
        if (rows) {
            for (var i = 0; i < rows.length; i++)
                sel += '<option value="' + rows[i]._id + '">' + rows[i].name + '</option>';
            sel += '</select>';
            res.end(sel);
        } else {
            res.end(JSON.stringify('[]'));
            if (err)
                console.log(err);
        }
    });
});

app.post('/api/alert', function(req, res) {
    msg = {};
    if (!req.body.mission_id || !ObjectID.isValid(req.body.mission_id) || !req.body.api || !req.body.channel || !req.body.text) {
        res.end('ERR');
        return;
    }
    msg.user_id = 0;
    msg.analyst = '';
    msg.channel = req.body.channel;
    msg.text = xssFilters.inHTMLData(req.body.text);
    msg.timestamp = (new Date).getTime();
    mdb.collection('users').findOne({ api: req.body.api, deleted: { $ne: true } }, function(err, row) {
        if (row) {
            msg.user_id = row._id;
            msg.username = row.username;


           mdb.collection('missions').aggregate([
                {
                    $match: { _id: ObjectID(req.body.mission_id), 'mission_users.user_id': ObjectID(msg.user_id), deleted: { $ne: true } }
                },{
                    $unwind: '$mission_users'
                },{
                    $match: { 'mission_users.user_id': ObjectID(msg.user_id) }
                },{
                    $project: {
                        permissions: '$mission_users.permissions',
                    }
                }
            ]).toArray(function(err, row) { 
                if (row) {
                    if( hasPermission(row[0].permissions, 'api_access')) {
                        sendToRoom(req.body.mission_id, JSON.stringify({act:'chat', arg:{messages:[msg]}}));
                        res.end('OK');
                    }
                } else {
                     if (err)
                        console.log(err);
                    res.end('ERR');
                }
            });
        } else {
            if (err)
                console.log(err);
            res.end('ERR');
        }
    });
});

app.post('/api/:table', function (req, res) {
    if (!req.session.loggedin) {
        res.end('ERR4');
        return;
    }
    res.writeHead(200, {"Content-Type": "application/json"});
// MISSIONS
    if (req.params.table !== undefined && req.params.table === 'missions') {

        // get missions
        if (req.body.oper === undefined) {
            mdb.collection('missions').aggregate([
                {
                    $match: { deleted: { $ne: true }}
                },{
                    $lookup: {
                        from: 'users',
                        localField: 'user_id',
                        foreignField: '_id',
                        as: 'username'
                    },
                },{
                    $project: {
                        _id: 1,
                        name: 1,
                        start_date: 1,
                        username: '$username.username'
                    }
                }
            ]).toArray(function(err, rows) {
                if (rows) {
                    res.end(JSON.stringify(rows))
                } else {
                    res.end(JSON.stringify('[]'));
                    if (err)
                        console.log(err);
                }
            });

        // edit mission
        } else if (req.body.oper === 'edit' && hasPermission(req.session.cop_permissions, 'manage_missions') && req.body._id && req.body.name && req.body.start_date) {
            req.body.name = xssFilters.inHTMLData(req.body.name);
            if (req.body.analyst === undefined || req.body.analyst === '')
                req.body.analyst = req.session.user_id;
            else
                req.body.analyst = xssFilters.inHTMLData(req.body.analyst);
            var new_values = { $set: { name: req.body.name, start_date: req.body.start_date }};
            mdb.collection('missions').updateOne({ _id: ObjectID(req.body._id) }, new_values, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR5'));
                    console.log(err);
                }
            });

        // add mission
        } else if (req.body.oper === 'add' && hasPermission(req.session.cop_permissions, 'manage_missions') && req.body.name && req.body.start_date) {
            req.body.name = xssFilters.inHTMLData(req.body.name);
            var mission = { name: req.body.name, start_date: req.body.start_date, user_id: ObjectID(req.session.user_id), mission_users: [], deleted: false };
            mission.mission_users[0] = { _id: ObjectID(null), user_id: ObjectID(req.session.user_id), permissions: ['all'], role: null };
            mdb.collection('missions').insertOne(mission, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR6'));
                }
            });

        // delete mission
        } else if (req.body.oper === 'del' && hasPermission(req.session.cop_permissions, 'delete_missions') && req.body._id !== undefined) {
            mdb.collection('missions').updateOne({ _id: ObjectID(req.body._id) }, { $set: { deleted: true } }, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                    //TODO: Also delete objects when they are mongo'ed
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR17'));
                }
            });

        } else {
            res.end(JSON.stringify('ERR14'));
        }

// USERS
    } else if (req.params.table !== undefined && req.params.table === 'users' && hasPermission(req.session.cop_permissions, 'manage_users')) {
        // get users
        if (req.body.oper === undefined) {
            mdb.collection('users').find({ deleted: { $ne: true }}, { password: 0 }).toArray(function(err, rows) {
                if (rows) {
                    res.end(JSON.stringify(rows))
                } else {
                    res.end(JSON.stringify('[]'));
                    if (err)
                        console.log(err);
                }
            });

        // edit user
        } else if (req.body.oper !== undefined && req.body.oper === 'edit' && req.body.name !== undefined && req.body._id) {
            if (req.body.name === 'admin')
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
            if (req.body.password !== '') {
                bcrypt.hash(req.body.password, null, null, function(err, hash) {
                    var new_values = { $set: { name: req.body.name, permissions: req.body.permissions, password: hash }};
                    mdb.collection('users').updateOne({ _id: ObjectID(req.body._id) }, new_values, function (err, result) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            res.end(JSON.stringify('ERR8'));
                            console.log(err);
                        }
                    });
                });
    
            // update user
            } else {
                var new_values = { $set: { name: req.body.name, permissions: req.body.permissions }};
                mdb.collection('users').updateOne({ _id: ObjectID(req.body._id) }, new_values, function (err, result) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        res.end(JSON.stringify('ERR9'));
                        console.log(err);
                    }
                });
            }

        // add user
        } else if (req.body.oper !== undefined && req.body.oper === 'add' && req.body.username && req.body.name !== undefined) {
            bcrypt.hash(req.body.password, null, null, function(err, hash) {
                if (!err) {
                    if (req.body.role === undefined || req.body.role === '')
                        req.body.role = null;
                    if (req.body.permissions === undefined || req.body.permissions === '')
                        req.body.permissions = null;
                    var api = crypto.randomBytes(32).toString('hex');
                    var user = { username: req.body.username, name: req.body.name, password: hash, permissions: req.body.permissions, api: api, avatar: '', deleted: false };
                    mdb.collection('users').insertOne(user, function (err, result) {
                        if (!err) {
                            res.end(JSON.stringify('OK'));
                        } else {
                            console.log(err);
                            res.end(JSON.stringify('ERR13'));
                        }
                    });
                } else
                    console.log(err);
            });

        // delete user
        } else if (req.body.oper !== undefined && req.body.oper === 'del' && req.body._id !== undefined) {
            if (req.body.name === 'admin') // don't delete admin
                res.end(JSON.stringify('ERR12'));
            else {
                mdb.collection('users').updateOne({ _id: ObjectID(req.body._id) }, { $set: { deleted: true } }, function (err, result) {
                    if (!err) {
                        res.end(JSON.stringify('OK'));
                    } else {
                        console.log(err);
                        res.end(JSON.stringify('ERR13'));
                    }
                });
            }
        } else {
            res.end(JSON.stringify('ERR14'));
        }

// ROLES
    } else if (req.params.table !== undefined && req.params.table === 'roles' && hasPermission(req.session.cop_permissions, 'manage_roles')) {
        // get roles
        if (req.body.oper === undefined) {

            mdb.collection('roles').aggregate([
                {
                    $match: { deleted: { $ne: true }}
                },{
                    $lookup: {
                        from: 'roles',
                        localField: 'sub_roles',
                        foreignField: '_id',
                        as: 'sub_role'
                    },
                },{
                    $project: {
                        _id: 1,
                        name: 1,
                        sub_roles:'$sub_role.name'
                    }
                }
            ]).toArray(function(err, rows) {
                if (rows) {
                    res.end(JSON.stringify(rows))
                } else {
                    res.end(JSON.stringify('[]'));
                    if (err)
                        console.log(err);
                }
            });

        // edit role
        } else if (req.body.oper !== undefined && req.body.oper === 'edit' && req.body.name && req.body._id) {
            req.body.name = xssFilters.inHTMLData(req.body.name);
            if (req.body.sub_roles)
                req.body.sub_roles = req.body.sub_roles.split(',').map(i => ObjectID(i));
            var new_values = { $set: { name: req.body.name, sub_roles: req.body.sub_roles }};
            mdb.collection('roles').updateOne({ _id: ObjectID(req.body._id) }, new_values, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR13'));
                }
            });

        // add role
        } else if (req.body.oper !== undefined && req.body.oper === 'add' && req.body.name) {
            req.body.name = xssFilters.inHTMLData(req.body.name);
            var role = { name: req.body.name, sub_roles: [], deleted: false };
            mdb.collection('roles').insertOne(role, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR19'));
                }
            });

        // delete role
        } else if (req.body.oper !== undefined && req.body.oper === 'del' && req.body._id !== undefined) {
            mdb.collection('roles').updateOne({ _id: ObjectID(req.body._id) }, { $set: { deleted: true } }, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    console.log(err);
                    res.end(JSON.stringify('ERR20'));
                }
            })
        } else {
            res.end(JSON.stringify('ERR21'));
        }

    // change password
    } else if (req.params.table !== undefined && req.params.table === 'change_password') {
        bcrypt.hash(req.body.newpass, null, null, function(err, hash) {
            mdb.collection('users').updateOne({ _id: ObjectID(req.session.user_id) }, { $set: { password: hash }}, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR21'));
                    console.log(err);
                }
            });
        });

    } else {
        res.end(JSON.stringify('ERR22'));
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
        if (req.query.mission !== undefined && req.query.mission && ObjectID.isValid(req.query.mission)) {
            mdb.collection('missions').findOne({ _id: ObjectID(req.query.mission), deleted: { $ne: true } }, function(err, row) {
                console.log(row);
                if (row) {
                    fs.readdir('./public/images/icons', function(err, icons) {
                        fs.readdir('./public/images/shapes', function(err, shapes) {
                            fs.readdir('./public/images/links', function(err, links) {
                                var mission_name = row.name;
                                //if (req.session.username === 'admin')
                                    mission_permissions = 'all'; //admin has all permissions
                                req.session.mission_role[req.query.mission] = mission_role;
                                req.session.mission_permissions[req.query.mission] = mission_permissions;
                                if (req.session.username === 'admin' || (mission_permissions && mission_permissions !== '')) // always let admin in
                                    res.render('cop', { title: 'MCSCOP - ' + mission_name, role: mission_role, permissions: mission_permissions, mission_name: mission_name, user_id: req.session.user_id, username: req.session.username, icons: icons.filter(getPNGs), shapes: shapes.filter(getPNGs), links: links.filter(getPNGs)});
                                else
                                    res.redirect('login');
                            });
                        });
                    });
                } else {
                    res.redirect('login');
                    if(err)
                        console.log(err);
                }

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
        mdb.collection('users').findOne({ username: { $eq: req.body.username }}, function(err, row) {
            if (row) {
                bcrypt.compare(req.body.password, row.password, function(err, bres) {
                    if (bres) {
                        req.session.user_id = row._id;
                        req.session.name = row.name;
                        req.session.username = row.username;
                        req.session.loggedin = true;
                        req.session.role = row.role;
                        req.session.sub_roles = [];
                        req.session.cop_permissions = row.permissions;
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
                if (err)
                    console.log(err);
                res.render('login', { title: 'MCSCOP', message: 'Invalid username or password.' });
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
        res.end('ERR23');
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
        res.end('ERR2424');
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
        res.end('ERR25');
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
        res.end('ERR26');
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
        res.end('ERR27');
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
        res.end('ERR28');
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
            mdb.collection('users').updateOne({ _id: ObjectID(req.body.id) }, { $set: { avatar: req.body.id + '.png' }}, function (err, result) {
                if (!err) {
                    res.end(JSON.stringify('OK'));
                } else {
                    res.end(JSON.stringify('ERR21'));
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
