function getParameterByName(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
}

// requirements!
global.jQuery = require('jquery');
global.$ = jQuery;
require('./jquery-ui.min.js');
require('./jquery-ui-timepicker-addon.min.js');
require('bootstrap');
var bootbox = require('./bootbox.min');
require('./jquery.jqGrid.min');
require('./grid.locale-en');
require('./fabric.min');
require('image-picker');
var jqGrid = require('./jquery.jqGrid.min');
var noUiSlider = require('nouislider');
var jstree = require('jstree');
require('./files');
require('./palette-color-picker.min');
var sharedb = require('sharedb/lib/client');
var richText = require('rich-text');
var StringBinding = require('sharedb-string-binding');
global.hljs = require('highlight.js');
var Quill = require('quill');
var bsw = require('./bootstrap-window');
global.mission = getParameterByName('mission');

// ---------------------------- PERMISSIONS & BUTTONS ----------------------------------
if (!permissions)
    permissions = [];
var diagram_rw = false;
var tasks_rw = false;
var details_rw = false;
// bind buttons
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_diagram') !== -1) {
    diagram_rw = true;
    $("#propName").prop('disabled', false);
    $("#newObjectButton").prop('disabled', false).click(newObject);
    $("#propFillColor").prop('disabled', false);
    $("#propStrokeColor").prop('disabled', false);
    $("#moveUp").prop('disabled', false).click(moveUp);
    $("#moveDown").prop('disabled', false).click(moveDown);
    $("#moveToFront").prop('disabled', false).click(moveToFront);
    $("#moveToBack").prop('disabled', false).click(moveToBack);
    $("#insertObjectButton").prop('disabled', false).click(insertObject);
    $("#deleteObjectButton").prop('disabled', false).click(deleteObjectConfirm);;
}
$("#play").click(function() { toggleAnimateSlider(); });
$("#toolsTab").click(function() { toggleToolbar('tools'); });
$("#tasksTab").click(function() { toggleToolbar('tasks'); });
$("#notesTab").click(function() { toggleToolbar('notes'); });
$("#filesTab").click(function() { toggleToolbar('files'); });
$("#eventsTab").click(function() { toggleTable('events'); });
$("#opnotesTab").click(function() { toggleTable('opnotes'); });
$("#chatTab").click(function() { toggleTable('chat'); });
$("#settingsTab").click(function() { toggleTable('settings'); });
$("#propName").change(function() { updatePropName(this.value) });
$("#zoomInButton").click(function() { zoomIn(); });
$("#zoomOutButton").click(function() { zoomOut(); });
$("#closeToolbarButton").click(closeToolbar);
$("#cancelLinkButton").click(cancelLink);
$("#editDetailsButton").click(function() { editDetails(); });
$("#newNoteButton").click(function() { newNote(); });
$("#downloadEventsButton").click(function() { downloadEvents(); });
$("#downloadDiagramButton").click(function() { downloadDiagram(); });
$("#downloadOpnotesButton").click(function() { downloadOpnotes(); });
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_tasks') !== -1) {
    tasks_rw = true;
    $("#hostTasks").prop('disabled', false);
    $("#networkTasks").prop('disabled', false);
    $("#ccirs").prop('disabled', false);
}
// more permissions stuff
var events_rw = false;
var events_del = false;
var opnotes_rw = false;
var opnotes_del = false;
var users_rw = false;
var notes_rw = false;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('create_events') !== -1)
        events_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('delete_events') !== -1)
        events_del = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('create_opnotes') !== -1)
        opnotes_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('delete_opnotes') !== -1)
        opnotes_del = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_users') !== -1)
        users_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_details') !== -1)
        details_rw = true;
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_notes') !== -1) {
        notes_rw = true;
        $("#newNoteButton").prop('disabled', false);
}


// ---------------------------- FABRIC CANVASES ----------------------------------
MAXWIDTH=2000;
MAXHEIGHT=2000;
fabric.Object.prototype.originX = fabric.Object.prototype.originY = 'center';
fabric.Group.prototype.hasControls = false;
fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerSize = 7;
fabric.Object.prototype.objectCaching = true;
var canvas = new fabric.Canvas('canvas', {
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    enableRetinaScaling: true,
    uniScaleTransform: true,
    width: 2000,
    height: 2000
});

// ---------------------------- MINIMAP ----------------------------------
var minimap = document.getElementById('minimapCanvas');
var minimapBg = document.getElementById('minimapBgCanvas');
var minimapCtx = minimap.getContext('2d');
var minimapBgCtx = minimapBg.getContext('2d');
minimap.width = minimapBg.width = 100;
minimap.height = minimapBg.height = 100;

// ---------------------------- GLOBALS ----------------------------------
var settings = {'zoom': 1.0, 'x': Math.round($('#diagram_jumbotron').width()/2), 'y': Math.round(700/2), 'diagram': 700, 'tools': 400, 'tasks': 400, 'notes': 400, 'files': 400};
var earliest_messages = {}; //= 2147483647000;
var creatingLink = false;
var firstObject = null;
var scale = 1;
var objectSelect = [{id:0, name:'none/unknown'}];
var userSelect = [{id:null, username:'none'}];
var roleSelect = [{id:null, name:'none'}];
var dateSlider = null;
var objectsLoaded = null;
var updatingObject = false;
var diagram;
var toolbarState = false;
var firstNode = null;
var zoom = 1.0;
var dirty = false;
var SVGCache = {};
var tempLinks = [];
var objectCache = {};
var resizeTimer = null;
var updateSettingsTimer = null;
var sliderTimer = null;
var activeToolbar = null;
var activeTable = 'events';
var activeChannel = 'log';
var chatPosition = {};
var firstChat = true;
var unreadMessages = {};
var shouldBlur = false;
var cellEdit = null;
var cellEditRow = null;
var clickComplete = false;
var msgId = 0;
var pendingMsg = [];
global.lastselection = {id: null, iRow: null, iCol: null};
var gridsize = 40;
var lastFillColor = '#000000';
var lastStrokeColor = '#ffffff';
global.addingRow = false;
var windowManager = null;

var wsdb;
var openDocs = {};
var shareDBConnection;
sharedb.types.register(richText.type);

// Rescale stroke widths based on object size
// http://jsfiddle.net/davidtorroija/nawLjtn8/
fabric.Object.prototype.resizeToScale = function () {
    switch (this.type) {
        case "circle":
            this.radius *= this.scaleX;
            this.scaleX = 1;
            this.scaleY = 1;
            break;
        case "ellipse":
            this.rx *= this.scaleX;
            this.ry *= this.scaleY;
            this.width = this.rx * 2;
            this.height = this.ry * 2;
            this.scaleX = 1;
            this.scaleY = 1;
            break;
        case "polygon":
        case "polyline":
            var points = this.get('points');
            for (var i = 0; i < points.length; i++) {
                var p = points[i];
                p.x *= this.scaleX
                p.y *= this.scaleY;
            }
            this.scaleX = 1;
            this.scaleY = 1;
            this.width = this.getBoundingBox().width;
            this.height = this.getBoundingBox().height;
            break;
        case "triangle":
        case "line":
        case "rect":
            this.width *= this.scaleX;
            this.height *= this.scaleY;
            this.scaleX = 1;
            this.scaleY = 1;
        default:
            break;
    }
}

fabric.Object.prototype.getBoundingBox = function () {
    var minX = null;
    var minY = null;
    var maxX = null;
    var maxY = null;
    switch (this.type) {
        case "polygon":
        case "polyline":
            var points = this.get('points');

            for (var i = 0; i < points.length; i++) {
                if (typeof (minX) == undefined) {
                    minX = points[i].x;
                } else if (points[i].x < minX) {
                    minX = points[i].x;
                }
                if (typeof (minY) == undefined) {
                    minY = points[i].y;
                } else if (points[i].y < minY) {
                    minY = points[i].y;
                }
                if (typeof (maxX) == undefined) {
                    maxX = points[i].x;
                } else if (points[i].x > maxX) {
                    maxX = points[i].x;
                }
                if (typeof (maxY) == undefined) {
                    maxY = points[i].y;
                } else if (points[i].y > maxY) {
                    maxY = points[i].y;
                }
            }
            break;
        default:
            minX = this.left;
            minY = this.top;
            maxX = this.left + this.width; 
            maxY = this.top + this.height;
    }
    return {
        topLeft: new fabric.Point(minX, minY),
        bottomRight: new fabric.Point(maxX, maxY),
        width: maxX - minX,
        height: maxY - minY
    }
}

// set up a listener for the event where the object has been modified
canvas.observe('object:modified', function (e) {
    if (e.target !== undefined && e.target.resizeToScale)
        e.target.resizeToScale();
});
 
// ---------------------------- Canvas Events  ----------------------------------
$('#diagram').mousedown(startPan);

canvas.on('object:rotating', function(options) {
    var step = 5;
    options.target.set({
        angle: Math.round(options.target.angle / step) * step,
    });
});

canvas.on('object:moving', function(options) {
    var grid = 1;
    options.target.set({
        left: Math.round(options.target.left / grid) * grid,
        top: Math.round(options.target.top / grid) * grid
    });
    var hAligned = false;
    var vAligned = false;
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).objType && canvas.item(i).objType === 'icon' && canvas.item(i) !== options.target) {
            if (Math.round(canvas.item(i).getCenterPoint().y) === Math.round(options.target.getCenterPoint().y)) {
                hAligned = true;
                if (!options.target.hGuide) {
                    var line = new fabric.Line([options.target.getCenterPoint().x - 500, options.target.getCenterPoint().y, options.target.getCenterPoint().x + 500, options.target.getCenterPoint().y], {
                        dad: options.target,
                        objType: 'guide',
                        stroke: '#66bfff',
                        strokeColor: '#66bfff',
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    tempLink = line;
                    canvas.add(line);
                    tempLinks.push(tempLink);
                    options.target.hGuide = line;
                }
            }
            if (Math.round(canvas.item(i).getCenterPoint().x) === Math.round(options.target.getCenterPoint().x)) {
                vAligned = true;
                if (!options.target.vGuide) {
                    var line = new fabric.Line([options.target.getCenterPoint().x, options.target.getCenterPoint().y - 500, options.target.getCenterPoint().x, options.target.getCenterPoint().y + 500], {
                        dad: options.target,
                        objType: 'guide',
                        stroke: '#66bfff',
                        strokeColor: '#66bfff',
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    tempLink = line;
                    canvas.add(line);
                    tempLinks.push(tempLink);
                    options.target.vGuide = line;
                }
            }
        }
    }
    if (!hAligned && options.target.hGuide) {
        canvas.remove(options.target.hGuide);
        delete options.target.hGuide;
    }
    if (!vAligned && options.target.vGuide) {
        canvas.remove(options.target.vGuide);
        delete options.target.vGuide;
    }
    var tmod = 0;
    var lmod = 0;
    if (options.target._objects) {
        tmod = options.target.getTop();
        lmod = options.target.getLeft();
    }
    dirty = true;
    var o = options.target._objects ? options.target._objects : [options.target];
    for (var i = 0; i < o.length; i++) {
        o[i].dirty = true;
        for (var j = 0; j < o[i].children.length; j++) {
            o[i].children[j].setTop(tmod + o[i].getTop() + o[i].getHeight());
            o[i].children[j].setLeft(lmod + o[i].getLeft() + o[i].getWidth()/2);
        }
    }
});

canvas.on('object:scaling', function(options) {
    var tmod = 0;
    var lmod = 0;
    if (options.target._objects) {
        tmod = options.target.getTop();
        lmod = options.target.getLeft();
    }
    dirty = true;
    var o = options.target._objects ? options.target._objects : [options.target];
    for (var i = 0; i < o.length; i++) {
        o[i].dirty = true;
        for (var j = 0; j < o[i].children.length; j++) {
            o[i].children[j].setTop(tmod + o[i].getTop() + o[i].getHeight()/2);
            o[i].children[j].setLeft(lmod + o[i].getLeft());
        }
    }
});

canvas.on('object:modified', function(options) {
    var tmod = 0;
    var lmod = 0;
    if (options.target._objects) {
        tmod = options.target.getTop();
        lmod = options.target.getLeft();
    }
    var o = options.target._objects ? options.target._objects : [options.target];
    if (options.target.hGuide) {
        canvas.remove(options.target.hGuide);
        delete options.target.hGuide;
    }
    if (options.target.vGuide) {
        canvas.remove(options.target.vGuide);
        delete options.target.vGuide;
    }
    for (var i = 0; i < o.length; i++) {
        var z = canvas.getObjects().indexOf(o[i])/2;
        if (o[i].objType === 'link')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o[i].id, type: o[i].objType, z: z}, msgId: msgHandler()}));
        else if (o[i].objType === 'icon')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o[i].id, type: o[i].objType, x: lmod + o[i].left, y: tmod + o[i].top, z: z, scale_x: o[i].scaleX, scale_y: o[i].scaleY, rot: o[i].angle}, msgId: msgHandler()}));
        else if (o[i].objType === 'shape')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o[i].id, type: o[i].objType, x: lmod + o[i].left, y: tmod + o[i].top, z: z, scale_x: o[i].width, scale_y: o[i].height, rot: o[i].angle}, msgId: msgHandler()}));
        updateMinimapBg();
    }
});

fabric.util.addListener(canvas.upperCanvasEl, 'dblclick', function (e) {
    var o = canvas.findTarget(e);
    if (canvas.getActiveObject() !== null && canvas.getActiveGroup() === null && !creatingLink) {
        if (o.objType !== undefined) {
            $('#propID').val(o.id);
            $('#propFillColor').val(o.fill);
            $('#propFillColor').data('paletteColorPickerPlugin').reload();
            $('#propStrokeColor').val(o.stroke);
            $('#propStrokeColor').data('paletteColorPickerPlugin').reload();
            $('#propName').val('');
            if (o.children !== undefined) {
                for (var i = 0; i < o.children.length; i++) {
                    if (o.children[i].objType === 'name')
                        $('#propName').val(o.children[i].text);
                }
            }
            $('#propType').val(o.objType);
            $('#prop-' + o.objType).val(o.image.replace('.svg','.png'));
            $('#prop-' + o.objType).data('picker').sync_picker_with_select();
            openToolbar('tools');
        }
    } else {
        closeToolbar();
    }
});

canvas.on('selection:created', function(options) {
    closeToolbar();
    for (var i = options.target._objects.length - 1; i >= 0; i--) {
        if (options.target._objects[i].objType === 'link') {
            canvas.getActiveGroup().removeWithUpdate(options.target._objects[i]);
        }
    }
});

canvas.on('object:selected', function(options) {
    var o = options.target;
    if (o && canvas.getActiveObject()) {
        if (o.objType !== undefined) {
            if (creatingLink) {
                if ((o.objType === 'icon' || o.objType === 'shape') && firstNode !== o) {
                    if (firstNode === null) {
                        firstNode = o;
                        showMessage('Click on a second node to complete the link.');
                    } else {
                        showMessage('Link created.', 5);
                        $('#cancelLink').hide();
                        var z = canvas.getObjects().indexOf(firstNode) - 1;
                        if (canvas.getObjects().indexOf(o) < z)
                            z = canvas.getObjects().indexOf(o) - 1;
                        lastFillColor = $('#propFillColor').val();
                        lastFillColor = $('#propStrokeColor').val();
                        diagram.send(JSON.stringify({act: 'insert_object', arg: {name:$('#propName').val(), type: 'link', image: $('#prop-link').val().replace('.png','.svg'), stroke_color:$('#propStrokeColor').val(), obj_a: firstNode.id, obj_b: o.id, z: z}, msgId: msgHandler()}));
                        firstNode = null;
                        creatingLink = false;
                    }
                }
            } else {
                $('#propID').val(o.id);
                $('#propFillColor').val(o.fill);
                $('#propFillColor').data('paletteColorPickerPlugin').reload();
                $('#propStrokeColor').val(o.stroke);
                $('#propStrokeColor').data('paletteColorPickerPlugin').reload();
                $('#propName').val('');
                if (o.children !== undefined) {
                    for (var i = 0; i < o.children.length; i++) {
                        if (o.children[i].objType === 'name')
                            $('#propName').val(o.children[i].text);
                    }
                }
                $('#propType').val(o.objType);
                $('#prop-' + o.objType).val(o.image.replace('.svg','.png'));
                $('#prop-' + o.objType).data('picker').sync_picker_with_select();
                if (toolbarState)
                    openToolbar('tools');
                if (options.e && options.e.ctrlKey)
                    editDetails();
            }
        }
    }
});

canvas.on('before:selection:cleared', function(options) {
    if (!updatingObject)
        closeToolbar();
});

canvas.on('before:render', function(e) {
    if (dirty) {
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).objType && canvas.item(i).objType === 'link') {
                var from = canvas.item(i).from;
                var to = canvas.item(i).to;
                var fromObj = null;
                var toObj = null;
                for (var j = 0; j < canvas.getObjects().length; j++) {
                    if (canvas.item(j).id == from) {
                        fromObj = canvas.item(j);
                    }
                    if (canvas.item(j).id == to) {
                        toObj = canvas.item(j);
                    }
                }
                if (fromObj && toObj && (fromObj.dirty || toObj.dirty || canvas.item(i).pending)) {
                    var fromAbs = fromObj.calcTransformMatrix();
                    var toAbs = toObj.calcTransformMatrix();
                    canvas.item(i).pending = false;
                    canvas.item(i).set({ 'x1': fromAbs[4], 'y1': fromAbs[5] });
                    canvas.item(i).set({ 'x2': toAbs[4], 'y2': toAbs[5] });
                    canvas.item(i).setCoords();
                    for (var j = 0; j < canvas.item(i).children.length; j++) {
                        canvas.item(i).children[j].set({'left': canvas.item(i).getCenterPoint().x, 'top': canvas.item(i).getCenterPoint().y });
                        var angle = (Math.atan2((canvas.item(i).y1 - canvas.item(i).y2), (canvas.item(i).x1 - canvas.item(i).x2))) * (180/Math.PI);
                        if(Math.abs(angle) > 90)
                            angle += 180;
                        canvas.item(i).children[j].set({'angle': angle});
                    }
                }
            }
        }
        if (tempLinks.length > 0) {
            for (var i = 0; i < tempLinks.length; i++) {
                if (tempLinks[i].objType === 'link') {
                    tempLinks[i].set({ 'x1': tempLinks[i].from.getCenterPoint().x, 'y1': tempLinks[i].from.getCenterPoint().y });
                    tempLinks[i].set({ 'x2': tempLinks[i].to.getCenterPoint().x, 'y2': tempLinks[i].to.getCenterPoint().y });
                } else if (tempLinks[i].objType === 'shape') {
                    tempLinks[i].set({top: tempLinks[i].dad.top - 7.5, left: tempLinks[i].dad.left - 7.5});
                }
            }
        }
        dirty = false;
    }
});

function getIcon(icon, cb) {
    var path = 'images/icons/';
    if (!SVGCache[icon]) {
        $.get(path + icon, function(data) {
            fabric.loadSVGFromString(data, function(objects, options) {
                SVGCache[icon] = fabric.util.groupSVGElements(objects, options);
                if (cb) {
                    cb();
                }
                objectsLoaded.pop();
            });
        }, 'text').fail(function() {
            $.get(path + 'missing.svg', function(data) {
                fabric.loadSVGFromString(data, function(objects, options) {
                    SVGCache[icon] = fabric.util.groupSVGElements(objects, options);
                    if (cb) {
                        cb();
                    }
                    objectsLoaded.pop();
                });
            }, 'text')
        });
    } else {
        objectsLoaded.pop();
        if (cb) {
            cb();
        }
    }
}

// check if shapes are chached before loading canvas
function checkIfShapesCached(msg) {
    if (objectsLoaded.length == 0) {
        console.log('cached');
        for (var o in msg) {
            if (msg[o].type === 'icon')
                objectsLoaded.push(false);
            addObjectToCanvas(msg[o]);
        }
        checkIfObjectsLoaded();
    } else {
        setTimeout(function() {
            checkIfShapesCached(msg);
        }, 50);
    }
}

function checkIfObjectsLoaded() {
    if (objectsLoaded.length == 0) {
        console.log('objects loaded');
        $('#modal').modal('hide');
        dirty = true;
        updateMinimapBg();
        canvas.renderAll();
        canvas.renderOnAddRemove = true;
    } else {
        setTimeout(checkIfObjectsLoaded, 50);
    }
}

//https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary
Number.prototype.round = function(places) {
  return +(Math.round(this + "e+" + places)  + "e-" + places);
}

// ---------------------------- CHAT / LOG WINDOW  ----------------------------------
function addChatMessage(msg, bulk) {
    if (!bulk)
        bulk = false;
    for (var i = 0; i < msg.messages.length; i++) {
        if (!earliest_messages[msg.messages[i].channel])
            earliest_messages[msg.messages[i].channel] = 2147483647000
        var pane = $('#' + msg.messages[i].channel);
        var ts = msg.messages[i].timestamp;
        if (ts < earliest_messages[msg.messages[i].channel]) {
            earliest_messages[msg.messages[i].channel] = ts;
        }
        if (msg.messages[i].prepend)
            pane.prepend('<div class="message-wraper"><div class="message"><div class="message-gutter"><img class="message-avatar" src="images/avatars/' + msg.messages[i].user_id + '.png"/></div><div class="message-content"><div class="message-content-header"><span class="message-sender">' + msg.messages[i].analyst + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + msg.messages[i].text + '</span></div></div>');
        else {
            var atBottom = $('#' + msg.messages[i].channel)[0].scrollHeight - Math.round($('#' + msg.messages[i].channel).scrollTop()) == $('#' + msg.messages[i].channel).outerHeight();
            var newMsg = $('<div class="message-wrapper"><div class="message"><div class="message-gutter"><img class="message-avatar" src="images/avatars/' + msg.messages[i].user_id + '.png"/></div><div class="message-content"><div class="message-content-header"><span class="message-sender">' + msg.messages[i].analyst + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + msg.messages[i].text + '</span></div></div>');
            if (!bulk && activeChannel ===  msg.messages[i].channel)
                newMsg.hide();
            newMsg.appendTo(pane);
            if (!bulk && activeChannel !== msg.messages[i].channel) {
                if (!unreadMessages[msg.messages[i].channel])
                    unreadMessages[msg.messages[i].channel] = 1;
                else
                    unreadMessages[msg.messages[i].channel]++;
                $('#unread-' + msg.messages[i].channel).text(unreadMessages[msg.messages[i].channel]).show();
            }
            if (!bulk && activeChannel === msg.messages[i].channel)
                newMsg.fadeIn('fast');
            if (atBottom)
                $('#' + msg.messages[i].channel).scrollTop($('#' + msg.messages[i].channel)[0].scrollHeight);
        }
        if (msg.messages[i].more)
            pane.prepend('<div id="get-more-messages"><span onClick="getMoreMessages(\'' + msg.messages[i].channel + '\')">Get more messages.</span></div>');
    }
}

function getMoreMessages(channel) {
    $('#get-more-messages').remove();
    diagram.send(JSON.stringify({act:'get_old_chats', arg: {channel: channel, start_from: earliest_messages[channel]}, msgId: msgHandler()}));
}

// ---------------------------- SETTINGS COOKIE ----------------------------------
function loadSettings() {
    if (decodeURIComponent(document.cookie) === '')
        document.cookie = "mcscop-settings=" + JSON.stringify(settings);
    var dc = decodeURIComponent(document.cookie);
    settings = JSON.parse(dc.split('mcscop-settings=')[1]);
    $('#diagram_jumbotron').height(settings.diagram);
    canvas.setZoom(settings.zoom);
    canvas.relativePan({ x: settings.x, y: settings.y });
}

function updateSettings() {
    if (updateSettingsTimer)
        window.clearTimeout(updateSettingsTimer);
    updateSettingsTimer = setTimeout(function() {
            document.cookie = "mcscop-settings=" + JSON.stringify(settings);
    }, 100);
}

function createNotesTree(arg) {
    $('#notes')
        .on('select_node.jstree', function(e, data) {
            var name = '';
            if (data.node && data.node.text)
                name = data.node.text;
            if (data.node.li_attr.isLeaf) {
                editDetails('notes' + data.selected[0], name);
            }
        }).jstree({
            'core': {
                'check_callback': true,
                'data': arg
            },
            'plugins': ['dnd', 'wholerow', 'contextmenu'],
            'contextmenu': {
                'select_node' : false,
                'items': function(node) {
                    return {
                        'mkdir': {
                            'separator_before': false,
                            'separator_after': false,
                            'label': 'New Note',
                            'action': function (obj) {
                                var _node = node;
                                bootbox.prompt('Note name?', function(name) {
                                    diagram.send(JSON.stringify({act: 'insert_note', arg: {name: name}, msgId: msgHandler()}));
                                });
                            }
                        },
                        'del': {
                            'separator_before': false,
                            'separator_after': false,
                            'label': 'Delete Note',
                            'action': function (obj) {
                                diagram.send(JSON.stringify({act: 'delete_note', arg: {id: node.id}, msgId: msgHandler()}));
                            }
                        }
                    }
                }
            }
        });
}

function editDetails(id, name) {
    var rw = false;
    if (!name)
        name = '';
    if (!id && canvas.getActiveObject()) {
        if (details_rw)
            rw = true;
        id = 'details-' + canvas.getActiveObject().id;
        if (canvas.getActiveObject().name_val)
            name = '- ' + canvas.getActiveObject().name_val.split('\n')[0];
    } else {
        if (notes_rw)
            rw = true;
    }
    if (id) {
        $('#modal-title').text('Edit Notes ' + name);
        $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">Close</button>');
        $('#modal-content').addClass('modal-details');
        if (!openDocs[id]) {
            openDocs[id] = shareDBConnection.get('mcscop', id);
            openDocs[id].subscribe(function(err) {
                if (openDocs[id].type === null) {
                    openDocs[id].create('', 'rich-text');
                }
                if (err) throw err;
                if (openDocs[id].type.name === 'rich-text') {
                    var w = windowManager.createWindow({
                        sticky:  false,
                        title: 'Edit Notes ' + name,
                        effect: 'none',
                        bodyContent: '<div id="object_details_' + id + '" class="object-details" style="resize: none;"></div>',
                        closeCallback: function() {
                            openDocs[id].destroy();
                            delete openDocs[id];
                        }    
                    });
                    w.$el.draggable({ handle: '.modal-header' }).children('.window-content').resizable({ minHeight: 153, minWidth: 300});
                    var quill = new Quill('#object_details_' + id, {
                        theme: 'snow',
                        readOnly: !rw,
                        modules: {
                            syntax: true,
                            toolbar: [
                                [{ header: [1, 2, false] }],
                                ['bold', 'italic', 'underline'],
                                ['image', 'code-block']
                            ]
                        }
                    });
                    quill.setContents(openDocs[id].data);
                    quill.on('text-change', function(delta, oldDelta, source) {
                        if (source !== 'user') return;
                        openDocs[id].submitOp(delta, {source: quill});
                    });
                    openDocs[id].on('op', function(op, source) {
                        if (source === quill) return;
                        quill.updateContents(op);
                    });
                } else {
                    var disabled = ' disabled';
                    if (details_rw)
                        disabled = '';
                    var w = windowManager.createWindow({
                        sticky:  false,
                        title: 'Edit Notes ' + name,
                        effect: 'none',
                        bodyContent: '<textarea id="object_details_' + id + '" class="object-details" style="resize: none; height: 100%"' + disabled + '></textarea>',
                        closeCallback: function() {
                            openDocs[id].destroy();
                            delete openDocs[id];
                        }    
                    });
                    w.$el.draggable({ handle: '.modal-header' }).children('.window-content').resizable({ minHeight: 153, minWidth: 300});
                    var element = document.getElementById('object_details_' + id);
                    var binding = new StringBinding(element, openDocs[id]);
                    binding.setup();
                }
            });
        } else
            console.log('document already open');
    }
}

function updateMinimap() {
    var scaleX = 100 / (MAXWIDTH * 2);
    var scaleY = 100 / (MAXHEIGHT * 2);
    var zoom = canvas.getZoom();
    var mLeft = (MAXHEIGHT - settings.x / zoom) * scaleX;
    var mTop = (MAXHEIGHT - settings.y / zoom) * scaleY;
    var mWidth = (canvas.width / zoom) * scaleX;
    var mHeight = (canvas.height / zoom) * scaleY;
    minimapCtx.clearRect(0, 0, minimapCtx.canvas.width, minimapCtx.canvas.height);
    minimapCtx.beginPath();
    minimapCtx.rect(mLeft, mTop, mWidth, mHeight);
    minimapCtx.stroke();
}

function updateMinimapBg() {
    var scaleX = 100 / (MAXWIDTH * 2);
    var scaleY = 100 / (MAXHEIGHT * 2);
    minimapBgCtx.clearRect(0, 0, minimapCtx.canvas.width, minimapCtx.canvas.height);
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).objType === 'icon' || canvas.item(i).objType === 'shape') {
            minimapBgCtx.fillRect((MAXWIDTH + canvas.item(i).getLeft()) * scaleX, (MAXHEIGHT + canvas.item(i).getTop()) * scaleY, 2, 2);
        }
    }
}

function zoomIn() {
    if (canvas.getZoom() > 2.0)
        return;
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), (canvas.getZoom() * 1.1).round(2));
    settings.x = Math.round(canvas.viewportTransform[4]);
    settings.y = Math.round(canvas.viewportTransform[5]);
    settings.zoom = canvas.getZoom();
    updateMinimap();
    updateSettings();
}

function zoomOut() {
    if (canvas.getZoom() < 0.6)
        return;
    canvas.zoomToPoint(new fabric.Point(canvas.width / 2, canvas.height / 2), (canvas.getZoom() / 1.1).round(2));
    settings.x = Math.round(canvas.viewportTransform[4]);
    settings.y = Math.round(canvas.viewportTransform[5]);
    settings.zoom = canvas.getZoom();
    updateSettings();
    var deltaX = 0;
    var deltaY = 0;
    var zoom = canvas.getZoom();
    if (canvas.viewportTransform[4] > MAXWIDTH * zoom)
        deltaX = Math.round(MAXWIDTH * zoom - canvas.viewportTransform[4]);
    else if (canvas.viewportTransform[4] - canvas.width < -MAXWIDTH * zoom)
        deltaX = Math.round(-MAXWIDTH * zoom - canvas.viewportTransform[4] + canvas.width);
    if (canvas.viewportTransform[5] > MAXHEIGHT * zoom)
        deltaY = Math.round(MAXHEIGHT * zoom - canvas.viewportTransform[5]);
    else if (canvas.viewportTransform[5] - canvas.height < -MAXHEIGHT * zoom)
        deltaY = Math.round(-MAXHEIGHT * zoom - canvas.viewportTransform[5] + canvas.height);
    if (deltaX !== 0 || deltaY !== 0)
        canvas.relativePan({ x: deltaX, y: deltaY});
    updateMinimap();
}

function getDate() {
    var date = new Date();
    return date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds();
}

function getRoleSelect() {
    roleSelect.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    var roles = {};
    for (var i = 0; i < roleSelect.length; i++) {
        roles[roleSelect[i].id] = roleSelect[i].name;
    }
    return roles;
}

function getUserSelect() {
    userSelect.sort(function(a, b) {
        return a.username.localeCompare(b.name);
    });
    var user = {};
    for (var i = 0; i < userSelect.length; i++) {
        user[userSelect[i].id] = userSelect[i].username;
    }
    return user;
}

function getObjectSelect() {
    objectSelect.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    var obj = {};
    for (var i = 0; i < objectSelect.length; i++) {
        obj[objectSelect[i].id] = objectSelect[i].name;
    }
    return obj;
}

function getOpnoteSubGridData(id) {
    var tdata = new Array();
    for (var i = 0; i < $('#opnotes2').getGridParam('data').length; i++) {
        if ($('#opnotes2').getGridParam('data')[i].event == id)
            tdata.push($('#opnotes2').getGridParam('data')[i]);
    }
    return tdata;
}

function epochToDateString(value){
    if (isNaN(value)) {
        return value;
    }
    var date = new Date(parseInt(value));
    return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
    
}

function dateStringToEpoch(value) {
    var parts = value.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
    var d = new Date(parts[1], parts[2]-1, parts[3], parts[4], parts[5], parts[6], parts[7]);
    return(d.getTime());
}

// temp
//canvas.add(new fabric.Line([-1950,-1950,1950,-1950],{ stroke: "#ff0000", strokeWidth: 1, selectable:false}));
//canvas.add(new fabric.Line([-1950,-1950,-1950,1950],{ stroke: "#ff0000", strokeWidth: 1, selectable:false}));
//canvas.add(new fabric.Line([1950,-1950,1950,1950],{ stroke: "#ff0000", strokeWidth: 1, selectable:false}));
//canvas.add(new fabric.Line([1950,1950,-1950,1950],{ stroke: "#ff0000", strokeWidth: 1, selectable:false}));

function startPan(event) {
    if (event.button != 2) {
        return;
    }
    var x0 = event.screenX;
    var y0 = event.screenY;
    function continuePan(event) {
        var x = event.screenX,
            y = event.screenY;
        if (x - x0 != 0 || y - y0 != 0)
        {
            var deltaX = x - x0;
            var deltaY = y - y0;
            var zoom = canvas.getZoom();
            if (canvas.viewportTransform[4] + deltaX > MAXWIDTH * zoom)
                deltaX = Math.round(MAXWIDTH * zoom - canvas.viewportTransform[4]);
            else if (canvas.viewportTransform[4] - canvas.width + deltaX < -MAXWIDTH * zoom)
                deltaX = Math.round(-MAXWIDTH * zoom - canvas.viewportTransform[4] + canvas.width);
            if (canvas.viewportTransform[5] + deltaY > MAXHEIGHT * zoom)
                deltaY = Math.round(MAXHEIGHT * zoom - canvas.viewportTransform[5]);
            else if (canvas.viewportTransform[5] - canvas.height + deltaY < -MAXHEIGHT * zoom)
                deltaY = Math.round(-MAXHEIGHT * zoom - canvas.viewportTransform[5] + canvas.height);
            canvas.relativePan({ x: deltaX, y: deltaY});
            x0 = x;
            y0 = y;
            settings.x = Math.round(canvas.viewportTransform[4]);
            settings.y = Math.round(canvas.viewportTransform[5]);
            updateMinimap();
        }
    }
    function stopPan(event) {
        updateSettings();
        $(window).off('mousemove', continuePan);
        $(window).off('mouseup', stopPan);
    };
    $(window).mousemove(continuePan);
    $(window).mouseup(stopPan);
    $(window).contextmenu(cancelMenu);
};

function msgHandler() {
    pendingMsg[msgId] = setTimeout(function() {
        for (m in pendingMsg) {
            clearTimeout(pendingMsg[m]);
        }
        canvas.clear();
        canvas.renderAll();
        $('#modal-close').hide();
        $('#modal-header').html('Attention!');
        $('#modal-body').html('<p>Connection lost! Please refresh the page to continue!</p>');
        $('#modal-footer').html('');
        $('#modal-content').removeAttr('style');
        $('#modal-content').removeClass('modal-details');
        $('#modal').removeData('bs.modal').modal({backdrop: 'static', keyboard: false});
    }, 30000);
    return msgId++; 
}

function newNote() {
    bootbox.prompt('Note name?', function(name) {
        diagram.send(JSON.stringify({act: 'insert_note', arg: {name: name}, msgId: msgHandler()}));
    });
}

function newObject() {
    canvas.deactivateAll().renderAll();
    openToolbar('tools');
}

function cancelMenu() {
    $(window).off('contextmenu', cancelMenu);
    return false;
}

function rgba2rgb(hex, a)
{
    hex = hex.replace('#','');
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;
    r1 = (1 - a) * 255 + a * r;
    g1 = (1 - a) * 255 + a * g;
    b1 = (1 - a) * 255 + a * b;
    var bin = r1 << 16 | g1 << 8 | b1;
    return (function(h){
        return new Array(7-h.length).join("0")+h
    })(bin.toString(16).toUpperCase())
}

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

function addObjectToCanvas(o, selected) {
    if (o.type === 'link') {
        var fromObject = null;
        var toObject = null;
        for (var i = 0; i < canvas.getObjects().length; i++) {
            if (canvas.item(i).id == o.obj_a) {
                fromObject = canvas.item(i);
            }
            if (canvas.item(i).id == o.obj_b) {
                toObject = canvas.item(i);
            }
        }
        var from = {x: 0, y: 0};
        var to = {x: 0, y: 0};
        var pending = true;
        if (fromObject !== null && toObject !== null) {
            var from = fromObject.getCenterPoint();
            var to = toObject.getCenterPoint();
            pending = false;
        }
        if (o.stroke_color === '') // don't allow links to disappear
            o.stroke_color = '#000000';
        var line = new fabric.Line([from.x, from.y, to.x, to.y], {
            pending: pending,
            id: o.id,
            objType: 'link',
            image: o.image,
            name_val: o.name,
            from: o.obj_a,
            to: o.obj_b,
            fill: '#000000',
            stroke: o.stroke_color,
            strokeWidth: 3,
            hasControls: false,
            selctable: true,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        var angle = (Math.atan2((line.y1 - line.y2), (line.x1 - line.x2))) * (180/Math.PI);
            if(Math.abs(angle) > 90)
                angle += 180;
        var name = new fabric.Text(o.name, {
            parent_id: o.id,
            parent: line,
            objType: 'name',
            selectable: false,
            originX: 'center',
            originY: 'top',
            textAlign: 'center',
            fill: '#000000',
            angle: angle,
            fontSize: 12,
            fontFamily: 'verdana',
            left: line.getCenterPoint().x,
            top: line.getCenterPoint().y
        });
        line.children = [name];
        canvas.add(line);
        canvas.add(name);
        line.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
    } else if (o.type === 'icon' && o.image !== undefined && o.image !== null) {
        getIcon(o.image, function() {
            SVGCache[o.image].clone(function(shape) {
                var name;
                shape.set({
                    fill: o.fill_color,
                    stroke: o.stroke_color,
                    strokeWidth: 1,
                    scaleX: o.scale_x,
                    scaleY: o.scale_y,
                    angle: o.rot,
                    id: o.id,
                    objType: o.type,
                    image: o.image,
                    name_val: o.name,
                    originX: 'left',
                    originY: 'top',
                    left: o.x,
                    top: o.y,
                    lockMovementX: !diagram_rw,
                    lockMovementY: !diagram_rw,
                    lockScalingX: !diagram_rw,
                    lockScalingY: !diagram_rw,
                    lockRotation: !diagram_rw
                });
                if (shape.paths && !shape.image.includes('static')) {
                    for (var i = 0; i < shape.paths.length; i++) {
                        var fill = shape.paths[i].getFill();
                        var fillAlpha = 1.0;
                        try {
                            if (fill.split("(")[1].split(")")[0].split(",")[3] < 1)
                                fillAlpha = 1 - fill.split("(")[1].split(")")[0].split(",")[3];
                        } catch (e) {}
                        if (shape.paths[i].fill != '#FFFFFF' && shape.paths[i].fill !== 'rgba(255,255,255,1)' && shape.paths[i].fill !== 'rgba(254,254,254,1)' && shape.paths[i].fill !== '') {
                            var color = '#' + rgba2rgb(o.fill_color, fillAlpha);
                            shape.paths[i].setFill(color);
                        }
                        if (o.stroke_color !== '' && shape.paths[i].stroke !== 'rgba(254,254,254,1)') {
                            shape.paths[i].setStroke(o.stroke_color);
                        }
                    }
                }
                name = new fabric.Text(o.name, {
                    parent_id: o.id,
                    parent: shape,
                    objType: 'name',
                    selectable: false,
                    originX: 'center',
                    originY: 'top',
                    textAlign: 'center',
                    fill: '#000000',
                    fontSize: 12,
                    fontFamily: 'lato',
                    left: o.x + shape.getWidth()/2,
                    top: o.y + shape.getHeight()
                });
                shape.children = [name];
                objectsLoaded.pop();
                canvas.add(shape);
                canvas.add(name);
                if (selected === 'single')
                    canvas.setActiveObject(shape);
                else if (selected === 'group')
                    canvas.getActiveGroup().addWithUpdate(shape);
                shape.moveTo(o.z*2);
                name.moveTo(o.z*2+1);
            });
        });
    } else if (o.type === 'shape') {
        var shape = o.image.split('-')[3].split('.')[0];
        if (shape === 'rect') {
            shape = new fabric.Rect({
                width: o.scale_x,
                height: o.scale_y,
                angle: o.rot,
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 2,
                id: o.id,
                objType: o.type,
                image: o.image,
                name_val: o.name,
                name: name,
                originX: 'left',
                originY: 'top',
                left: o.x,
                top: o.y,
                lockMovementX: !diagram_rw,
                lockMovementY: !diagram_rw,
                lockScalingX: !diagram_rw,
                lockScalingY: !diagram_rw,
                lockRotation: !diagram_rw
            });
        } else if (shape === 'circle') {
            shape = new fabric.Ellipse({
                rx: o.scale_x / 2,
                ry: o.scale_y / 2,
                angle: o.rot, 
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 2,
                id: o.id,
                objType: o.type,
                image: o.image,
                name_val: o.name,
                name: name,
                originX: 'left',
                originY: 'top',
                left: o.x,
                top: o.y,
                lockMovementX: !diagram_rw,
                lockMovementY: !diagram_rw,
                lockScalingX: !diagram_rw,
                lockScalingY: !diagram_rw,
                lockRotation: !diagram_rw
            });
        } else
            return;
        name = new fabric.Text(o.name, {
            parent_id: o.id,
            parent: shape,
            objType: 'name',
            selectable: false,
            originX: 'center',
            originY: 'top',
            textAlign: 'center',
            fill: '#000000',
            fontSize: 12,
            fontFamily: 'verdana',
            left: o.x + shape.getWidth()/2,
            top: o.y + shape.getHeight()
        });
        shape.children = [name];
        canvas.add(shape);
        canvas.add(name);
        if (selected === 'single')
            canvas.setActiveObject(shape);
        else if (selected === 'group')
            canvas.getActiveGroup().addWithUpdate(shape);
        shape.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
    }
}

function insertLink() {
    creatingLink = true;
    showMessage('Click on a node to start a new link.');
    $('#cancelLink').show();
}

function cancelLink() {
    firstObject = null;
    creatingLink = false;
    showMessage('Link cancelled.',5);
    $('#cancelLink').hide();
}

function insertObject() {
    closeToolbar();
    if ($('#propType').val() === 'link')
        insertLink();
    else {
        var center = new fabric.Point(canvas.width / 2, canvas.height / 2);
        lastFillColor = $('#propFillColor').val();
        lastStrokeColor = $('#propStrokeColor').val();
        diagram.send(JSON.stringify({act: 'insert_object', arg:{name:$('#propName').val(), fill_color:$('#propFillColor').val(), stroke_color:$('#propStrokeColor').val(), image:$('#prop-' + $('#propType').val()).val().replace('.png','.svg'), type:$('#propType').val(), x: Math.round(center.x / canvas.getZoom() - settings.x / canvas.getZoom()), y: Math.round(center.y / canvas.getZoom() - settings.y / canvas.getZoom()), z: canvas.getObjects().length}, msgId: msgHandler()})); 
    }
}

function sendChatMessage(msg, channel) {
    diagram.send(JSON.stringify({act: 'insert_chat', arg: {channel: channel, text: msg}, msgId: msgHandler()}));
}

// move objects up / down on canvas
function moveToZ(o, z) {
    if (o) {
        if (o.objType === 'link')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o.id, type: o.objType, z: z}, msgId: msgHandler()}));
        else if (o.objType === 'icon')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o.id, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.scaleX, scale_y: o.scaleY, rot: o.angle}, msgId: msgHandler()}));
        else if (o.objType === 'shape')
            diagram.send(JSON.stringify({act: 'move_object', arg: {id: o.id, type: o.objType, x: o.left, y: o.top, z: z, scale_x: o.width, scale_y: o.height, rot: o.angle}, msgId: msgHandler()}));
    }
}

function moveToFront() {
    var zTop = canvas.getObjects().length - tempLinks.length - 2;
    var o = canvas.getActiveObject();
    moveToZ(o, zTop/2);
}

function moveToBack() {
    var o = canvas.getActiveObject();
    var z = 0;
    moveToZ(o, z);
}

function moveUp() {
    var o = canvas.getActiveObject();
    if (canvas.getActiveObject().id && canvas.getObjects().indexOf(o) < canvas.getObjects().length - 2 - tempLinks.length) {
        var z = canvas.getObjects().indexOf(o) / 2 + 1;
        moveToZ(o, z);
    }
}

function moveDown() {
    var o = canvas.getActiveObject();
    if (canvas.getActiveObject().id && canvas.getObjects().indexOf(o) > 0) {
        var z = canvas.getObjects().indexOf(o) / 2 - 1;
        moveToZ(o, z);
    }
}

// show message above canvas for link creation, etc
function showMessage(msg, timeout) {
    $('#message').html('<span class="messageHeader">' + msg + '</span>');
    $('#message').show();
    if (timeout !== undefined) {
        setTimeout(function() {
            $('#message').html('');
            $('#message').hide();
        }, timeout * 1000);
    }
}

function updatePropName(name) {
    var o = canvas.getActiveObject();
    if (o) {
        for (var i = 0; i < o.children.length; i++) {
            if (o.children[i].objType === 'name')
                o.children[i].text = name;
        }
        for (var i = 0; i < objectSelect.length; i++) {
            if (objectSelect[i].id == o.id) {
                objectSelect[i].name = name.split('\n')[0];
                break;
            }
        }
        canvas.renderAll();
        changeObject(o);
        $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
        $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
    }
}

function updatePropFillColor(color) {
    var o = canvas.getActiveObject();
    if (o) {
        lastFillColor = $('#propFillColor').val();
        o.fill = color;
        changeObject(o);
    }
}

function updatePropStrokeColor(color) {
    var o = canvas.getActiveObject();
    if (o) {
        lastStrokeColor = $('#propStrokeColor').val();
        o.stroke = color;
        changeObject(o);
    }
}

// replace an objects icon with another or change an icon's colors
function changeObject(o) {
    var tempObj = {};
    tempObj.id = o.id;
    tempObj.x = o.left;
    tempObj.y = o.top;
    tempObj.z = canvas.getObjects().indexOf(o);
    tempObj.scale_x = o.scaleX;
    tempObj.scale_y = o.scaleY;
    tempObj.rot = o.angle;
    tempObj.type = o.objType;
    tempObj.fill_color = o.fill;
    tempObj.stroke_color = o.stroke;
    tempObj.image = o.image;
    tempObj.name = '';
    for (var i=0; i < o.children.length; i++) {
        if (o.children[i].objType === 'name') {
            tempObj.name = o.children[i].text;
        }
    }
    diagram.send(JSON.stringify({act: 'change_object', arg: tempObj, msgId: msgHandler()}));
}

// bottom table toggle
function toggleTable(mode) {
    $('#' + activeTable + 'Tab').removeClass('active-horiz-tab');
    $('#' + mode + 'Tab').addClass('active-horiz-tab');
    activeTable = mode;
    switch(mode) {
        case 'events':
            $('#events').show();
            $('#opnotes').hide();
            $('#chat').hide();
            $('#settings').hide();
            break;
        case 'opnotes':
            $('#events').hide();
            $('#opnotes').show();
            $('#chat').hide();
            $('#settings').hide();
            break;
        case 'chat':
            $('#events').hide();
            $('#opnotes').hide();
            $('#chat').show();
            $('#settings').hide();
            if (firstChat) {
                $('#log').scrollTop($('#log')[0].scrollHeight);
                firstChat = false;
            }
            break;
        case 'settings':
            $('#events').hide();
            $('#opnotes').hide();
            $('#chat').hide();
            $('#settings').show();
            break;
    }
}

// toolbar toggle, open, etc
function toggleToolbar(mode) {
    if ($('#toolbar-body').width() === 0) {
        openToolbar(mode);
    } else {
        if (activeToolbar === mode)
            closeToolbar();
        else
            openToolbar(mode);
    }
}

function openToolbar(mode) {
    if (!toolbarState || mode !== activeToolbar)
        $('#' + activeToolbar + 'Tab').removeClass('active-tab');
        $('#toolbar-body').animate({width: Math.min($('#diagram_jumbotron').width()-60, settings[mode])}, {duration: 200});
    toolbarState = true;
    activeToolbar = mode;
    $('#' + mode + 'Tab').addClass('active-tab');
    switch(mode) {
        case 'tools':
            $('#toolsForm').show();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#filesForm').hide();
            $('#propFillColorSpan').show();
            if (canvas.getActiveObject()) {
                if (diagram_rw)
                    $('#toolbarTitle').html('Edit Object');
                else
                    $('#toolbarTitle').text('View Object');
                $('#propNameGroup').show();
                $('#propObjectGroup').show();
                $('#editDetailsButton').show();
                $('#deleteObjectButton').show();
                $('#insertObjectButton').hide();
                $('#newObjectButton').show();
                $('#propObjectGroup').tabs('disable');
                var objType = $('#propType').val();
                if (objType === 'link')
                    $('#propFillColorSpan').hide();
                var index = $('#propObjectGroup a[href="#tabs-' + objType + '"]').parent().index();
                $('#propObjectGroup').tabs('enable', index);
                $('#propObjectGroup').tabs('option', 'active', index);
            } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
                $('#toolbarTitle').html('New Object');
                $('#propID').val('');
                $('#propNameGroup').show();
                $('#propName').val('');
                $('#propFillColor').val(lastFillColor);
                $('#propFillColor').data('paletteColorPickerPlugin').reload();
                $('#propStrokeColor').val(lastStrokeColor);
                $('#propStrokeColor').data('paletteColorPickerPlugin').reload();
                $('#propType').val('icon');
                $('#prop-icon').val('00-000-icon-hub.png');
                $('#prop-icon').data('picker').sync_picker_with_select();
                $('#propObjectGroup').tabs('enable');
                $('#propObjectGroup').tabs('option', 'active', 0);
                $('#newObjectButton').hide();
                $('#editDetailsButton').hide();
                $('#deleteObjectButton').hide();
                $('#insertObjectButton').show();
            }
            break;
        case 'tasks':
            $('#toolsForm').hide();
            $('#tasksForm').show();
            $('#notesForm').hide();
            $('#filesForm').hide();
            break;
        case 'notes':
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').show();
            $('#filesForm').hide();
            break;
        case 'files':
            $('#toolsForm').hide();
            $('#tasksForm').hide();
            $('#notesForm').hide();
            $('#filesForm').show();
            break;
    }
}

function closeToolbar() {
    if (activeToolbar)
        $('#' + activeToolbar + 'Tab').removeClass('active-tab');
    toolbarState = false;
    $('#propName').blur();
    $('#toolbar-body').animate({width: "0px"}, 200);
}

function timestamp(str){
    var date = new Date(str);
    return (date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds());
}
//start sharedb tasks
function startTasks() {
    console.log('starting tasks');
    if (shareDBConnection.state === 'connected') {
        console.log('tasks started');
        var hostTasksDoc;
        hostTasksDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'hostTasks');
        hostTasksDoc.subscribe(function(err) {
            if (hostTasksDoc.type === null) {
                hostTasksDoc.create('Host tasks:');
            }
            if (err) throw err;
            var element = document.getElementById('hostTasks');
            var binding = new StringBinding(element, hostTasksDoc);
            binding.setup();
        });
        var networkTasksDoc;
        networkTasksDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'networkTasks');
        networkTasksDoc.subscribe(function(err) {
            if (networkTasksDoc.type === null) {
                networkTasksDoc.create('Network tasks:');
            }
            if (err) throw err;
            var element = document.getElementById('networkTasks');
            var binding = new StringBinding(element, networkTasksDoc);
            binding.setup();
        });
        var ccirDoc;
        ccirDoc = shareDBConnection.get('mcscop', 'mission' + mission + 'ccirs');
        ccirDoc.subscribe(function(err) {
            if (ccirDoc.type === null) {
                ccirDoc.create('CCIRs:');
            }
            if (err) throw err;
            var element = document.getElementById('ccirs');
            var binding = new StringBinding(element, ccirDoc);
            binding.setup();
        });
    } else {
        setTimeout(function() {
            console.log('retrying tasks connection');
            startTasks();
        }, 1000);
    }
}

//download diagram to png
function downloadDiagram(link) {
    link.href = canvas.toDataURL('png');
    link.download = 'diagram.png';
}

//download opnotes to csv
function downloadOpnotes() {
    var data = $('#opnotes2').getGridParam('data');
    for (var r = 0; r < data.length; r++) {
        data[r].event_time = epochToDateString(data[r].event_time);
    }
    JSONToCSVConvertor(data, 'opnotes.csv');
}

//download events to csv
function downloadEvents() {
    var data = $('#events2').getGridParam('data');
    for (var r = 0; r < data.length; r++) {
        data[r].event_time = epochToDateString(data[r].event_time);
        data[r].discovery_time = epochToDateString(data[r].discovery_time);
    }
    JSONToCSVConvertor($('#events2').getGridParam('data'), 'opnotes.csv');
}

// https://ciphertrick.com/2014/12/07/download-json-data-in-csv-format-cross-browser-support/
function msieversion() {
    var ua = window.navigator.userAgent;
    var msie = ua.indexOf("MSIE ");
    if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./))
    {
        return true;
    } else { // If another browser,
        return false;
    }
}

function JSONToCSVConvertor(JSONData, fileName) {
    var arrData = typeof JSONData != 'object' ? JSON.parse(JSONData) : JSONData;
    var CSV = '';
    var row = "";
    for (var index in arrData[0]) {
        row += index + ',';
    }
    row = row.slice(0, -1);
    CSV += row + '\r\n';
    for (var i = 0; i < arrData.length; i++) {
        var row = "";
        for (var index in arrData[i]) {
            var arrValue = arrData[i][index] == null ? "" : '"' + arrData[i][index] + '"';
            row += arrValue + ',';
        }
        row.slice(0, row.length - 1);
        CSV += row + '\r\n';
    }
    if (CSV == '') {
        return;
    }
    var fileName = "Result";
    if(msieversion()){
        var IEwindow = window.open();
        IEwindow.document.write('sep=,\r\n' + CSV);
        IEwindow.document.close();
        IEwindow.document.execCommand('SaveAs', true, fileName + ".csv");
        IEwindow.close();
    } else {
        var uri = 'data:application/csv;charset=utf-8,' + escape(CSV);
        var link = document.createElement("a");
        link.href = uri;
        link.style = "visibility:hidden";
        link.download = fileName + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function toggleAnimateSlider() {
    if (sliderTimer) {
        window.clearTimeout(sliderTimer);
        $('#play').addClass('ui-icon-play');
        $('#play').removeClass('ui-icon-stop');
    } else {
        $('#play').removeClass('ui-icon-play');
        $('#play').addClass('ui-icon-stop');
        animateSlider(0);
    }
}

function animateSlider(i) {
    setSlider(0, i);
    var next = i;
    sliderTimer = setTimeout(function() {
        next += 1;
        if (next >= dateSlider.noUiSlider.options.range.max)
            next = 0;
        animateSlider(next);
    }, 5000);
}

function setSlider(i, value) {
    var r = [null,null];
    r[i] = value;
    dateSlider.noUiSlider.set(r);
}

function resizeTables() {
    $("#events2").setGridWidth(Math.round($('#tables').width()-5));
    $("#opnotes2").setGridWidth($('#tables').width()-5);
    $("#users").setGridWidth($('#tables').width()-5);
}

function resizeCanvas() {
    if (canvas.getHeight() != $('#diagram').height()) {
        canvas.setHeight($('#diagram').height());
    }
    if (canvas.getWidth() != $('#diagram').width()) {
        canvas.setWidth($('#diagram').width());
    }
    updateMinimap();
}

function startTime() {
    var today = new Date();
    var eh = today.getHours();
    var uh = today.getUTCHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    m = checkTime(m);
    s = checkTime(s);
    $('#est').html('Local: ' + eh + ":" + m + ":" + s);
    $('#utc').html('UTC: ' + uh + ":" + m + ":" + s);
    var t = setTimeout(startTime, 500);
}

function checkTime(i) {
    if (i < 10) {i = "0" + i};
    return i;
}

function deleteObjectConfirm() {
    $('#modal-title').text('Are you sure?');
    $('#modal-body').html('<p>Are you sure you want to delete this object?</p>');
    $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-danger" data-dismiss="modal" onClick="cop.deleteObject();">Yes</button> <button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">No</button>');
    $('#modal-content').removeAttr('style');
    $('#modal-content').removeClass('modal-details');
    $('#modal').modal('show')
}

function deleteObject() {
    if (canvas.getActiveObject().id) {
        diagram.send(JSON.stringify({act: 'delete_object', arg: {id:canvas.getActiveObject().id, type:canvas.getActiveObject().objType}, msgId: msgHandler()}));
    }
}

function deleteRowConfirm(type, table, id, prefix) {
    $('#modal-title').text('Are you sure?');
    $('#modal-body').html('<p>Are you sure you want to delete this row?</p>');
    $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-danger" data-dismiss="modal" onClick="cop.deleteRow(\'' + type + '\', \'' + table + '\', \'' + id + '\', \'' + prefix + '\');">Yes</button> <button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">No</button>');
    $('#modal-content').removeAttr('style');
    $('#modal-content').removeClass('modal-details');
    $('#modal').modal('show')
}

function deleteRow(type, table, id, prefix) {
    diagram.send(JSON.stringify({act: 'delete_' + type, arg: {id: id}, msgId: msgHandler()}));
    $(table).jqGrid('delRowData', prefix + id);
}

function saveRow(type, table, id, prefix) {
    addingRow = false;
    var data = {};
    var act = "update_" + type;
    if (id.indexOf('jqg') !== -1) {
        $(table + ' #' + prefix + id).find('input, select, textarea').each(function () {
            data[this.name] = $(this).val();
        });
        act = "insert_" + type;
    }
    else {
        $(table).jqGrid('saveRow', id); 
        data = $(table).getRowData(id);
    }
    if (data.event_time)
        data.event_time = dateStringToEpoch(data.event_time);
    if (data.discovery_time)
        data.discovery_time = dateStringToEpoch(data.discovery_time);
    $(table).jqGrid('restoreRow', prefix + id, function(){ setTimeout(function() { diagram.send(JSON.stringify({act: act, arg: data, msgId: msgHandler()}));} ,10) });
}

$(document).ready(function() {
    startTime();
    $('.modal-dialog').draggable({ handle: '.modal-header' });
    $('.modal-content').resizable({ minHeight: 153, minWidth: 300});
    // ---------------------------- SOCKETS ----------------------------------
    if (location.protocol === 'https:') {
        diagram = new WebSocket('wss://' + window.location.host + '/mcscop/');
        wsdb = new WebSocket('wss://' + window.location.host + '/mcscop/');
    } else {
        diagram = new WebSocket('ws://' + window.location.host + '/mcscop/');
        wsdb = new WebSocket('ws://' + window.location.host + '/mcscop/');
    }
    shareDBConnection = new sharedb.Connection(wsdb);
    wsdb.onopen = function() {
        wsdb.send(JSON.stringify({act: 'stream', arg: ''}));
    };

    // ---------------------------- MAIN LOADER ----------------------------------
    diagram.onopen = function() {
        $('#modal').modal('hide');
        $('#modal-title').text('Please wait...!');
        $('#modal-body').html('<p>Loading COP, please wait...</p><img src="images/loading.gif"/>');
        $('#modal-footer').html('');
        $('#modal').modal('show')
        setTimeout(function() {
            console.log('connect');
            diagram.send(JSON.stringify({act:'join', arg: {mission: mission}, msgId: msgHandler()}));
            console.log('get roles');
            diagram.send(JSON.stringify({act:'get_roles', arg: {}, msgId: msgHandler()}));
            console.log('get users list');
            diagram.send(JSON.stringify({act:'get_users', arg: {}, msgId: msgHandler()}));
            console.log('get objects');
            diagram.send(JSON.stringify({act:'get_objects', arg: {}, msgId: msgHandler()}));
            console.log('get events');
            diagram.send(JSON.stringify({act:'get_events', arg: {}, msgId: msgHandler()}));
            console.log('get opnotes');
            diagram.send(JSON.stringify({act:'get_opnotes', arg: {}, msgId: msgHandler()}));
            console.log('get chat history');
            diagram.send(JSON.stringify({act:'get_all_chats', arg: {}, msgId: msgHandler()}));
            console.log('get notes');
            diagram.send(JSON.stringify({act:'get_notes', arg: {}, msgId: msgHandler()}));
        }, 100);
    };
    diagram.onmessage = function(msg) {
        msg = JSON.parse(msg.data);
        switch(msg.act) {
            case 'ack':
                clearTimeout(pendingMsg[msg.arg]);
                delete pendingMsg[msg.arg];
                break;
            case 'bulk_chat':
                addChatMessage(msg.arg, true);
                break;
            case 'chat':
                addChatMessage(msg.arg);
                break;
            case 'disco':
                canvas.clear();
                canvas.renderAll();
                $('#modal-close').hide();
                $('#modal-header').html('Attention!');
                $('#modal-body').html('<p>Connection lost! Please refresh the page to continue!</p>');
                $('#modal-footer').html('');
                $('#modal-content').removeAttr('style');
                $('#modal-content').removeClass('modal-details');
                $('#modal').removeData('bs.modal').modal({backdrop: 'static', keyboard: false});
                break;
            case 'update_files':
                $('#files').jstree('refresh');
                break;
            case 'all_objects':
                objectSelect = [{id:0, name:'none/unknown'}];
                objectsLoaded = [];
                for (var o in msg.arg) {
                    if (msg.arg[o].type !== 'link') {
                        objectSelect.push({id:msg.arg[o].id, name:msg.arg[o].name.split('\n')[0]});
                    }
                    if (msg.arg[o].type === 'icon' && SVGCache[msg.arg[o].image] === undefined && msg.arg[o].image !== undefined && msg.arg[o].image !== null) {
                        var shape = msg.arg[o].image;
                        SVGCache[msg.arg[o].image] = null;
                        objectsLoaded.push(false);
                        getIcon(msg.arg[o].image);
                    }
                }
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                checkIfShapesCached(msg.arg);
                break;
            case 'all_events':
                var eventTableData = [];
                for (var evt in msg.arg) {
                    eventTableData.push(msg.arg[evt]);
                }
                $('#events2').jqGrid('setGridParam', { 
                    datatype: 'local',
                    data: eventTableData
                }).trigger("reloadGrid");
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'all_users':
                var userTableData = [];
                for (var user in msg.arg) {
                    userTableData.push(msg.arg[user]);
                }
                $('#users').jqGrid('setGridParam', {
                    datatype: 'local',
                    data: userTableData
                }).trigger("reloadGrid");
                userSelect = userSelect.concat(msg.arg);
                $('#events2').jqGrid('setColProp', 'assignment', { editoptions: { value: getUserSelect() }});
                break; 
            case 'all_roles':
                roleSelect = roleSelect.concat(msg.arg);
                $('#users').jqGrid('setColProp', 'role', { editoptions: { value: getRoleSelect() }});
                break;
            case 'all_opnotes':
                var opnoteTableData = [];
                for (var evt in msg.arg) {
                    opnoteTableData.push(msg.arg[evt]);
                }
                $('#opnotes2').jqGrid('setGridParam', { 
                    datatype: 'local',
                    data: opnoteTableData
                }).trigger("reloadGrid");
                break;
            case 'all_notes':
                createNotesTree(msg.arg);
                break;
            case 'insert_note':
                $('#notes').jstree(true).create_node('#', msg.arg);
                break;
            case 'delete_note':
                var node = $('#notes').jstree(true).get_node(msg.arg.id, true);
                if (node)
                    $('#notes').jstree(true).delete_node(node);
                break;
            case 'change_object':
                var o = msg.arg;
                var selected = '';
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).id === o.id) {
                        var to = canvas.item(i);
                        if (to.active) {
                            updatingObject = true;
                            selected = 'single';
                            if (canvas.getActiveGroup()) {
                                selected = 'group';
                                canvas.getActiveGroup().remove(to);
                            }
                        }
                        if (o.type === 'icon') {
                            var children = to.children.length;
                            for (var k = 0; k < children; k++)
                                canvas.remove(to.children[k]);
                            canvas.remove(to);
                            addObjectToCanvas(o, selected);
                            canvas.renderAll();
                        } else if (o.type === 'shape' || o.type === 'link') {
                            if (o.type === 'link' && o.stroke_color === '') // don't let links disappear
                                o.stroke_color = '#000000';
                            canvas.item(i).setStroke(o.stroke_color);
                            canvas.item(i).setFill(o.fill_color);
                            canvas.item(i).set('dirty', true);
                            canvas.renderAll();
                        }
                        updatingObject = false;
                        break;
                    }
                }
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                break;
            case 'move_object':
                dirty = true;
                var o = msg.arg;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).id == o.id) {
                        var obj = canvas.item(i);
                        obj.dirty = true;
                        if (o.type !== 'link') {
                            obj.angle = o.rot;
                            if (o.type === 'icon') {
                                obj.scaleX = o.scale_x;
                                obj.scaleY = o.scale_y;
                            } else if (o.type === 'shape') {
                                obj.width = o.scale_x;
                                obj.height = o.scale_y;
                            }
                            var tmod = 0;
                            var lmod = 0;
                            if (obj.active && canvas.getActiveGroup())
                                canvas.getActiveGroup().removeWithUpdate(obj);
                            obj.animate({left: o.x, top: o.y}, {
                                duration: 100,
                                onChange: function() {
                                    dirty = true;
                                    obj.dirty = true;
                                    for (var j = 0; j < obj.children.length; j++) {
                                        obj.children[j].setTop(tmod + obj.getTop() + obj.getHeight());
                                        obj.children[j].setLeft(lmod + obj.getLeft() + obj.getWidth()/2);
                                    }
                                    obj.setCoords();
                                    canvas.renderAll();
                                }, 
                                onComplete: function() {
                                    updateMinimapBg();
                                }
                            });
                        }
                        if (i !== o.z*2) {
                            if (i < o.z*2) {
                                obj.moveTo((o.z)*2 + 1);
                                for (var k = 0; k < obj.children.length; k++)
                                    obj.children[k].moveTo(canvas.getObjects().indexOf(obj));
                            } else {
                                obj.moveTo(o.z*2);
                                for (var k = 0; k < obj.children.length; k++)
                                    obj.children[k].moveTo(canvas.getObjects().indexOf(obj)+1);
                            }
                        }
                        break;
                    }
                }
                break;
            case 'update_event':
                var evt = msg.arg;
                $('#events2').jqGrid('setRowData', evt.id, evt);
                break;
            case 'insert_event':
                var evt = msg.arg;
                $('#events2').jqGrid('addRowData', evt.id, evt, 'last');
                $('#events2').jqGrid('sortGrid', 'event_time', false, 'asc');
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'delete_event':
                var evt = msg.arg;
                $('#events2').jqGrid('delRowData', evt.id);
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                break;
            case 'update_opnote':
                var evt = msg.arg;
                $('#opnotes2').jqGrid('setRowData', evt.id, evt);
                break;
            case 'insert_opnote':
                var evt = msg.arg;
                $('#opnotes2').jqGrid('addRowData', evt.id, evt, 'last');
                $('#opnotes2').jqGrid('sortGrid', 'event_time', false, 'asc');
                break;
            case 'delete_opnote':
                var evt = msg.arg;
                $('#opnotes2').jqGrid('delRowData', evt.id);
                break;
            case 'insert_object':
                var o = msg.arg;
                addObjectToCanvas(o, false);
                if (o.type !== 'link') {
                    objectSelect.push({id:o.id, name:o.name.split('\n')[0]});
                }
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                updateMinimapBg();
                break;
            case 'delete_object':
                var id = msg.arg;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i).id == id) {
                        var object = canvas.item(i);
                        if (canvas.item(i).children !== undefined) {
                            for (var k = 0; k < object.children.length; k++) {
                                canvas.remove(object.children[k]);
                            }
                        }
                        if (object.active && canvas.getActiveGroup())
                            canvas.getActiveGroup().removeWithUpdate(object);
                        canvas.remove(object);
                        break;
                    }
                }
                updateMinimapBg();
                canvas.renderAll();
                break;
        }
    };

    diagram.onclose = function() {
        canvas.clear();
        canvas.renderAll();
        $('#modal-close').hide();
        $('#modal-title').text('Attention!');
        $('#modal-body').html('<p>Connection lost! Please refesh the page to retry!</p>');
        $('#modal-footer').html('');
        $('#modal-content').removeAttr('style');
        $('#modal-content').removeClass('modal-details');
        $('#modal').removeData('bs.modal').modal({backdrop: 'static', keyboard: false});
    };

    startTasks();

    // ---------------------------- IMAGE PICKER ----------------------------------
    $('#propObjectGroup').tabs({
        beforeActivate: function(e, u) {
            $('#propType').val(u.newPanel.attr('id').split('-')[1]);
            if ($('#propType').val() === 'link')
                $('#propFillColorSpan').hide();
            else
                $('#propFillColorSpan').show();
        }
    });
    $.each(['icon','shape','link'], function(i, v) {
        $('#prop-' + v).imagepicker({
            hide_select : true,
            initialized: function() {
                if (!diagram_rw)
                    $("#propObjectGroup").find("div").unbind('click');
            },
            selected : function() {
                if (!diagram_rw)
                    return;
                if (canvas.getActiveObject() !== null && canvas.getActiveObject() !== undefined && (canvas.getActiveObject().objType === 'icon' || canvas.getActiveObject().objType === 'shape')) {
                    var obj = canvas.getActiveObject();
                    var oldZ = canvas.getObjects().indexOf(canvas.getActiveObject());
                    obj.image = $(this).val().replace('.png','.svg');
                    var type = $(this).val().split('-')[2];
                    if (obj.objType !== type)
                        return;
                    updatingObject = true;
                    changeObject(obj);
                    updatingObject = false;
                } else {
                    var type = $(this).val().split('-')[2];
                    $('#propType').val(type)
                }
            }
        });
    });

    // ---------------------------- SLIDER ----------------------------------
    dateSlider = document.getElementById('slider');
    noUiSlider.create(dateSlider, {
        start: [-1,1],
        behaviour: 'drag',
        range: {
            'min': [-1],
            'max': [1]
        },
        connect: [false, true, false],
        step: 1
    });

    dateSlider.noUiSlider.on('update', function(values, handle) {
        if ($('#events2').getRowData()) {
            var filter = [];
            if (parseInt(values[1]) === $('#events2').getRowData().length) {
                if (parseInt(values[0]) > -1)
                    filter = [parseInt(values[0])];
            } else {
                for (var i = parseInt(values[0]); i <= parseInt(values[1]); i ++) {
                    filter.push(i);
                }
            }
            if (tempLinks.length > 0) {
                for (var i = 0; i < tempLinks.length; i++) {
                    canvas.remove(tempLinks[i]);
                }
                tempLinks = [];
            }
            if (filter.length === 1) {
                $('#message').show();
                $('#message').css('display','inline-block');
            } else {
                $('#message').hide();
            }
            var rows = $('#events2').getRowData();
            for (var i = 0; i < rows.length; i++) {
                if (rows[i]) {
                    if (filter.indexOf(i) !== -1) {
                        if (filter.length === 1)
                            $('#message').html('<span class="messageHeader">' + timestamp(rows[i].event_time) + '</span><br/><span class="messageBody">' + rows[i].short_desc.replace('\n','<br>') + '</span>');
                        $($('#events2').jqGrid("getInd", rows[i].id, true)).addClass('highlight');
                        var from = null;
                        var to = null;
                        var tempLink;
                        for (var j = 0; j < canvas.getObjects().length; j++) {
                            if (canvas.item(j).id == rows[i].source_object || canvas.item(j).id == rows[i].dest_object) {
                                if (canvas.item(j).id == rows[i].source_object) {
                                    from = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: from,
                                        objType: 'shape',
                                        width: from.getWidth() + 10,
                                        height: from.getHeight() + 10,
                                        stroke: 'red',
                                        fill: 'rgba(0,0,0,0)',
                                        strokeWidth: 5,
                                        originX: 'left',
                                        originY: 'top',
                                        left: from.left - 7.5,
                                        top: from.top - 7.5,
                                        selectable: false,
                                        evented: false
                                    });
                                    var tempShape = shape;
                                    tempLinks.push(tempShape);
                                    canvas.add(shape);
                                } else if (canvas.item(j).id == rows[i].dest_object) {
                                    to = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: to,
                                        objType: 'shape',
                                        width: to.getWidth() + 10,
                                        height: to.getHeight() + 10,
                                        stroke: 'red',
                                        fill: 'rgba(0,0,0,0)',
                                        strokeWidth: 5,
                                        originX: 'left',
                                        originY: 'top',
                                        left: to.left - 7.5,
                                        top: to.top - 7.5,
                                        selectable: false,
                                        evented: false
                                    });
                                    var tempShape = shape;
                                    tempLinks.push(tempShape);
                                    canvas.add(shape);
                                }
                            }
                            if (from && to) {
                                var line = new fabric.Line([from.getCenterPoint().x, from.getCenterPoint().y, to.getCenterPoint().x, to.getCenterPoint().y], {
                                    objType: 'link',
                                    from: from,
                                    to: to,
                                    stroke: 'red',
                                    strokeColor: 'red',
                                    strokeWidth: 8,
                                    strokeDashArray: [15,10],
                                    selectable: false,
                                    evented: false
                                });
                                tempLink = line;
                                canvas.add(line);
                                tempLinks.push(tempLink);
                                break;
                            }
                        }
                    } else {
                        $($('#events2').jqGrid("getInd", rows[i].id, true)).removeClass('highlight');
                    }
                }
            }
            canvas.renderAll();
        }
    });
    // ---------------------------- JQGRIDS ----------------------------------
    $(window).click(function(e) {
        if (cellEdit && clickComplete) {
            if ($(e.target).attr('id') === 'ui-datepicker-div' || $(e.target).parents("#ui-datepicker-div").length > 0 || $.contains(cellEditRow[0], e.target)) {
            }
            else {
                cellEdit();
            }
        }
        clickComplete = true;
    });
    // ---------------------------- OPNOTES TABLE ----------------------------------
    $("#opnotes2").jqGrid({
        idPrefix: 'opnotes_',
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        height: 280,
        rowNum: 9999,
        cellEdit: true,
        sortable: true,
        pager: '#opnotesPager',
        pgbuttons: false,
        sortname: 'event_time',
        sortorder: 'asc',
        pgtext: null,
        viewrecords: false,
        shrinkToFit: true,
        autowidth: true,
        toolbar: [true, 'top'],
        colModel: [
            { label: 'Id', name: 'id', hidden: true, width: 0, fixed: 0, key: true, editable: false },
            { label: ' ', template: 'actions', fixed: true, formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!opnotes_del)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="cop.deleteRowConfirm(\'opnote\', \'#opnotes2\', \'' + options.rowId + '\', \'opnotes_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> ';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-row ui-inline-save-row" id="jSaveButton_' + options.rowId + '" onclick="cop.saveRow(\'opnote\', \'#opnotes2\', \'' + options.rowId + '\', \'opnotes_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-cell ui-inline-save-cell" id="jSaveButton_' + options.rowId + '" onclick="$(\'#opnotes2\').saveCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-row" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\'); addingRow = false;" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    buttons +=  '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-cell" id="jCancelButton_' + options.rowId + '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="btn_cancel_' + options.rowId + '" onclick="$(\'#opnotes2\').restoreCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    return buttons;
                },
                width: 45,
                hidden: !opnotes_rw,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Id', name: 'event', width: 40, fixed: true, editable: opnotes_rw },
            { label: 'Event Time', name: 'event_time', width: 180, fixed: true, resizable: false, editable: opnotes_rw, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: false,
                        useCurrent: true,
                        beforeShow: function (input, inst) {
                            var rect = input.getBoundingClientRect();
                            setTimeout(function () {
                                inst.dpDiv.css({ top: rect.top + window.scrollY - inst.dpDiv.height() - 10 });
                            }, 0);
                        }
                    })
                },
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                }
            }},
            { label: 'Host/Device', name: 'source_object', width: 100, fixed: true, editable: opnotes_rw },
            { label: 'Tool', name: 'tool', width: 100, fixed: true, editable: opnotes_rw },
            { label: 'Action', name: 'action', width: 200, fixed: false, edittype: 'textarea', editable: opnotes_rw, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                return 'style="white-space: pre-wrap;"';
            }},
            { label: 'Analyst', name: 'analyst', width: 100, fixed: true, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id, cn, val, iRow, iCol) {
            if (lastselection.id && lastselection.id !== id) {
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-cell').hide();
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-cell').hide();
            }
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-cell').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-cell').show();
            lastselection = {id: id, iRow: iRow, iCol: iCol};
        },
        beforeSaveCell: function(options, col, value) {
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#opnotes2').jqGrid('resetSelection');
            lastselection.id = null;
            var data = $('#opnotes2').getRowData(options);
            data[col] = value;
            if (data.event_time)
                data.event_time = dateStringToEpoch(data.event_time);
            delete data.actions;
            delete data.undefined;
            diagram.send(JSON.stringify({act: 'update_opnote', arg: data, msgId: msgHandler()}));
        },
        afterEditCell: function(id, name, val, iRow, iCol) {
            // this handles clicking outside a cell while editing... a janky blur
            clickComplete = false;
            cellEditRow = $('#' + id);
            cellEdit = function() {
                $('#opnotes2').saveCell(iRow,iCol);
                cellEdit = null;
            }
        },
        afterRestoreCell: function (options) {
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#opnotes2').jqGrid('resetSelection');
        }

    });
    $('#opnotes2').jqGrid('navGrid', '#opnotesPager', {
        add: false,
        edit: false,
        del: false,
        refresh: false,
    })
    if (opnotes_rw) {
        $('#opnotes2').jqGrid('navGrid').jqGrid('navButtonAdd', '#opnotesPager',{
            position:"last",
            caption:"",
            buttonicon:"ui-icon-plus",
            onClickButton: function() {
                if (cellEdit)
                    cellEdit();
                if (!addingRow) {
                    addingRow = true;
                    $('#opnotes2').jqGrid('addRow', {position: 'last', initdata: {event_time: getDate()}, addRowParams: {
                            keys: true,
                            beforeSaveRow: function(options, id) {
                                addingRow = false;
                                data = {};
                                $(this).find('input, select, textarea').each(function () {
                                    data[this.name] = $(this).val();
                                });
                                $('#opnotes2').jqGrid('restoreRow', id, function(){});
                                data.event_time = dateStringToEpoch(data.event_time);
                                delete data.actions;
                                diagram.send(JSON.stringify({act: 'insert_opnote', arg: data, msgId: msgHandler()}));
                                $('#opnotes2').jqGrid('resetSelection');
                            },
                            oneditfunc: function(id, cn, val, iRow, iCol) {
                                if (lastselection.id && lastselection.id !== id) {
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-row').hide();
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-row').hide();
                                }
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-row').show();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-row').show();
                                lastselection = {id: id, iRow: iRow, iCol: iCol};
                            },
                            afterrestorefunc: function() {
                                addingRow = false;
                            }
                        }
                   });
                }
            }
        });
    }
    $('#t_opnotes2').append($("<div><input id=\"opnotesSearchText\" type=\"text\"></input>&nbsp;" +
        "<button id=\"opnotesSearch\" type=\"button\">Search</button></div>"));
    $("#opnotesSearchText").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            $("#opnotesSearch").click();
        }
    });
    $("#opnotesSearch").button({}).click(function () {
        var $grid = $('#opnotes2');
        var rules = [], i, cm, postData = $grid.jqGrid("getGridParam", "postData"),
            colModel = $grid.jqGrid("getGridParam", "colModel"),
            searchText = $("#opnotesSearchText").val(),
            l = colModel.length;
        for (i = 0; i < l; i++) {
            cm = colModel[i];
            if (cm.search !== false && (cm.stype === undefined || cm.stype === "text")) {
                rules.push({
                    field: cm.name,
                    op: "cn",
                    data: searchText
                });
            }
        }
        postData.filters = JSON.stringify({
            groupOp: "OR",
            rules: rules
        });
        $grid.jqGrid("setGridParam", { search: true });
        $grid.trigger("reloadGrid", [{page: 1, current: true}]);
        return false;
    });
    // ---------------------------- EVENTS TABLE ----------------------------------
    $("#events2").jqGrid({
        idPrefix: 'events_',
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        height: 250,
        rowNum: 9999,
        subGrid: true,
        cellEdit: true,
        pager: '#eventsPager',
        pgbuttons: false,
        sortname: 'event_time',
        sortorder: 'asc',
        shrinkToFit: true,
        autowidth: true,
        pgtext: null,
        viewrecords: false,
        toolbar: [true, "top"],
        subGridRowExpanded: function(subgridId, rowid) {
            var subgridTableId = subgridId + "_t";
            $("#" + subgridId).html("<table id='" + subgridTableId + "'></table>");
            $("#" + subgridTableId).jqGrid({
                datatype: 'local',
                autowidth: true,
                data: getOpnoteSubGridData(rowid),
                colModel: [
                    { label: 'OpId', name: 'id', width: 40, fixed: true, key: true, editable: false },
                    { label: 'Event Time', name: 'event_time', width: 180, fixed: true, editable: false, formatter: epochToDateString },
                    { label: 'Host/Device', name: 'source_object', editable: false },
                    { label: 'Tool', name: 'tool', editable: false },
                    { label: 'Action', name: 'action', width: 250, editable: false, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                        return 'style="white-space: pre-wrap;"';
                    }},
                    { label: 'Analyst', name: 'analyst', width: 100, fixed: true, editable: false },
                ],
            });
        },
        colModel: [
            { label: ' ', name: 'actions', fixed: true, formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!events_del)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="cop.deleteRowConfirm(\'event\', \'#events2\', \'' + options.rowId + '\', \'events_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> ';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save ui-inline-save-row" id="jSaveButton_' + options.rowId + '" onclick="cop.saveRow(\'event\', \'#events2\', \'' + options.rowId + '\', \'events_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save ui-inline-save-cell" id="jSaveButton_' + options.rowId + '" onclick="$(\'#events2\').saveCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Cancel new row" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-row" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\'); addingRow = false;" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    buttons +=  '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-cell" id="jCancelButton_' + options.rowId + '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="btn_cancel_' + options.rowId + '" onclick="$(\'#events2\').restoreCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    return buttons;
                },
                width: 50,
                hidden: !events_rw,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Id', name: 'id', width: 40, fixed: true, key: true, editable: false },
            { label: 'Event Time', name: 'event_time', width: 180, editable: events_rw, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: false,
                        beforeShow: function (input, inst) {
                            var rect = input.getBoundingClientRect();
                            setTimeout(function () {
                                inst.dpDiv.css({ top: rect.top + window.scrollY - inst.dpDiv.height() - 10 });
                            }, 0);
                        }
                    })
                },
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                }
            }},
            { label: 'Discovery Time', name: 'discovery_time', width: 180, editable: events_rw, formatter: epochToDateString, editoptions: {
                dataInit: function (element) {
                    $(element).datetimepicker({
                        dateFormat: "yy-mm-dd",
                        timeFormat: "HH:mm:ss.l",
                        controlType: 'select',
                        showMillisec: false,
                        beforeShow: function (input, inst) {
                            var rect = input.getBoundingClientRect();
                            setTimeout(function () {
                                inst.dpDiv.css({ top: rect.top + window.scrollY - inst.dpDiv.height() - 10 });
                            }, 0);
                        }
                    })
                },
                editrules: {
                    date: true,
                    minValue: 0
                },
                formatoptions: {
                    newformat: 'yy-mm-dd HH:mm:ss.l'
                }
            }},
            { label: 'Source', name: 'source_object', width: 80, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: {
                value: getObjectSelect()
            }},
            { label: 'SPort', name: 'source_port', width: 60, editable: events_rw },
            { label: 'Destination', name: 'dest_object', width: 80, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: {
                value: getObjectSelect()
            }},
            { label: 'DPort', name: 'dest_port', width: 60, editable: events_rw },
            { label: 'Event Type', name: 'event_type', width: 150, editable: events_rw },
            { label: 'Event Description', name: 'short_desc', width: 200, edittype: 'textarea', editable: events_rw, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                return 'style="white-space: pre-wrap;"';
            }},
            { label: 'Assignment', name: 'assignment', width: 100, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: {
                value: getUserSelect()
            }},
            { label: 'Analyst', name: 'analyst', width: 100, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id, cn, val, iRow, iCol) {
            if (lastselection.id && lastselection.id !== id) {
                $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-cell').hide();
                $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-cell').hide();
            }                
            $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
            $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-cell').show();
            $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-cell').show();
            lastselection = {id: id, iRow: iRow, iCol: iCol};
        },
        beforeSaveCell: function (options, col, value) {
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#events2').jqGrid('resetSelection');
            lastselection.id = null;
            var data = $('#events2').getRowData(options);
            data[col] = value;
            if (data.event_time)
                data.event_time = dateStringToEpoch(data.event_time);
            if (data.discovery_time)
                data.discovery_time = dateStringToEpoch(data.discovery_time);
            delete data.actions;
            diagram.send(JSON.stringify({act: 'update_event', arg: data, msgId: msgHandler()}));
        },
        afterEditCell: function(id, name, val, iRow, iCol) {
            // this handles clicking outside a cell while editing... a janky blur
            clickComplete = false;
            cellEditRow = $('#' + id);
            cellEdit = function() {
                $('#events2').saveCell(iRow,iCol);
                cellEdit = null;
            }
        },
        afterRestoreCell: function (options) {
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#events2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#events2').jqGrid('resetSelection');
        }
    });
    //events pager
    $('#events2').jqGrid('navGrid', '#eventsPager', {
        add: false,
        edit: false,
        del: false,
        refresh: false
    })
    //events buttons
    if (events_rw) {
        $('#events2').jqGrid('navGrid').jqGrid('navButtonAdd', '#eventsPager', {
            position:"last",
            caption:"", 
            buttonicon:"ui-icon-plus", 
            onClickButton: function(){
                if (cellEdit)
                    cellEdit();
                if (!addingRow) {
                    addingRow = true;
                    $('#events2').jqGrid('addRow', {position: 'last', initdata: {event_time: getDate(), discovery_time: getDate()}, addRowParams: {
                            keys: true,
                            beforeSaveRow: function(options, id) {
                                addingRow = false;
                                data = {};
                                $(this).find('input, select, textarea').each(function () {
                                    data[this.name] = $(this).val();
                                });
                                data.event_time = dateStringToEpoch(data.event_time);
                                data.discovery_time = dateStringToEpoch(data.discovery_time);
                                delete data.actions;
                                $('#events2').jqGrid('restoreRow', id, function(){ setTimeout(function () { diagram.send(JSON.stringify({act: 'insert_event', arg: data, msgId: msgHandler()})); } , 10); });
                                $('#events2').jqGrid('resetSelection');
                            },
                            oneditfunc: function(id) {
                                if (lastselection.id && lastselection.id !== id) {
                                    $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                                    $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-row').hide();
                                    $('#events2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-row').hide();
                                }
                                $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
                                $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-row').show();
                                $('#events2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-row').show();
                                lastselection = {id: id, iRow: null, iCol: null};
                            },
                            afterrestorefunc: function() {
                                addingRow = false;
                            }
                        }
                   });
                }
            }
        });
    }
    //events search
    $('#t_events2').append($("<div><input id=\"globalSearchText\" type=\"text\"></input>&nbsp;" +
        "<button id=\"globalSearch\" type=\"button\">Search</button></div>"));
    $("#globalSearchText").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            $("#globalSearch").click();
        }
    });
    $("#globalSearch").button({}).click(function () {
        var $grid = $('#events2');
        var rules = [], i, cm, postData = $grid.jqGrid("getGridParam", "postData"),
            colModel = $grid.jqGrid("getGridParam", "colModel"),
            searchText = $("#globalSearchText").val(),
            l = colModel.length;
        for (i = 0; i < l; i++) {
            cm = colModel[i];
            if (cm.search !== false && (cm.stype === undefined || cm.stype === "text")) {
                rules.push({
                    field: cm.name,
                    op: "cn",
                    data: searchText
                });
            }
        }
        postData.filters = JSON.stringify({
            groupOp: "OR",
            rules: rules
        });
        $grid.jqGrid("setGridParam", { search: true });
        $grid.trigger("reloadGrid", [{page: 1, current: true}]);
        return false;
    });
    // ---------------------------- USERS TABLE ----------------------------------
    $("#users").jqGrid({
        idPrefix: 'users_',
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        height: 350,
        rowNum: 9999,
        cellEdit: true,
        pager: '#usersPager',
        pgbuttons: false,
        sortname: 'username',
        sortorder: 'asc',
        pgtext: null,
        viewrecords: false,
        colModel: [
            { label: 'Id', name: 'id', width: 40, fixed: true, key: true, editable: false },
            { label: 'Username', name: 'username', width: 150, fixed: true, editable: false },
            { label: 'Role', name: 'role', width: 100, editable: users_rw, formatter: 'select', edittype: 'select', editoptions: {
                value: getRoleSelect()
            }},
            { label: 'Permissions', name: 'permissions', width: 200, editable: users_rw, edittype: 'select', formatter: 'select', editoptions: {
                    value: {none: 'None', all:'All', manage_users:'Manage Users', modify_diagram: 'Modify Diagram', create_events: 'Create Events', delete_events: 'Delete Events', modify_notes: 'Modify Notes', create_opnotes: 'Create Opnotes', delete_opnotes: 'Delete Opnotes', modify_tasks: 'Modify Tasks', modify_details: 'Modify Details', modify_files: 'Modify Files'},
                    multiple: true,
                    size: 10
                }
            }
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id, cn, val, iRow, iCol) {
            lastselection = {id: id, iRow: iRow, iCol: iCol};
        },
        beforeSaveCell: function (options, col, value) {
            $('#users').jqGrid('resetSelection');
            lastselection.id = null;
            var data = $('#users').getRowData(options);
            data[col] = value;
            delete data.actions;
            diagram.send(JSON.stringify({act: 'update_user', arg: data, msgId: msgHandler()}));
        },
        afterEditCell: function(id, name, val, iRow, iCol) {
            // this handles clicking outside a cell while editing... a janky blur
            clickComplete = false;
            cellEditRow = $('#' + id);
            cellEdit = function() {
                $('#users').saveCell(iRow,iCol);
                cellEdit = null;
            }
        },
        afterRestoreCell: function (options) {
            $('#users').jqGrid('resetSelection');
        }
    });
    //users pager
    $('#users').jqGrid('navGrid', '#usersPager', {
        add: false,
        edit: false,
        del: false,
        refresh: false
    })

    // ---------------------------- CHAT ----------------------------------
    $('.channel').click(function(e) {
        var c = e.target.id.split('-')[1];
        if ($('#' + activeChannel)[0].scrollHeight - $('#' + activeChannel).scrollTop() === $('#' + activeChannel).outerHeight())
            chatPosition[activeChannel] = 'bottom';
        else
            chatPosition[activeChannel] = $('#' + activeChannel).scrollTop();
        $('.channel-pane').hide();
        $('.channel').removeClass('channel-selected');
        $('#' + c).show();
        unreadMessages[c] = 0;
        $('#unread-' + c).hide();
        if (!chatPosition[c] || chatPosition[c] === 'bottom')
            $('#' + c).scrollTop($('#' + c)[0].scrollHeight);
        $('#channel-' + c).addClass('channel-selected');
        activeChannel = c;
    });
    // ---------------------------- WINDOW MANAGER ----------------------------------
    windowManager = new bsw.WindowManager({
        container: "#windowPane",
        windowTemplate: $('#details_template').html()
    });
    // ---------------------------- MISC ----------------------------------
    $('[name="propFillColor"]').paletteColorPicker({
        colors: [
            {'#000000': '#000000'},
            {'#808080': '#808080'},
            {'#c0c0c0': '#c0c0c0'},
            {'#ffffff': '#ffffff'},
            {'#800000': '#800000'},
            {'#ff0000': '#ff0000'},
            {'#808000': '#808000'},
            {'#ffff00': '#ffff00'},
            {'#008000': '#008000'},
            {'#00ff00': '#00ff00'},
            {'#008080': '#008080'},
            {'#00ffff': '#00ffff'},
            {'#000080': '#000080'},
            {'#0000ff': '#0000ff'},
            {'#800080': '#800080'},
            {'#ff00ff': '#ff00ff'}  
        ],
        position: 'upside',
        timeout: 2000,
        close_all_but_this: true,
        onchange_callback: function (color) {
            if (color !== $('#propFillColor').val())
                updatePropFillColor(color);
        }
    });
    $('[name="propStrokeColor"]').paletteColorPicker({
        colors: [
            {'#000000': '#000000'},
            {'#808080': '#808080'},
            {'#c0c0c0': '#c0c0c0'},
            {'#ffffff': '#ffffff'},
            {'#800000': '#800000'},
            {'#ff0000': '#ff0000'},
            {'#808000': '#808000'},
            {'#ffff00': '#ffff00'},
            {'#008000': '#008000'},
            {'#00ff00': '#00ff00'},
            {'#008080': '#008080'},
            {'#00ffff': '#00ffff'},
            {'#000080': '#000080'},
            {'#0000ff': '#0000ff'},
            {'#800080': '#800080'},
            {'#ff00ff': '#ff00ff'}  
        ],
        position: 'upside',
        timeout: 2000, // default -> 2000
        close_all_but_this: true,
        onchange_callback: function (color) {
            if (color !== $('#propStrokeColor').val())
                updatePropStrokeColor(color);
        }
    });
    $("#diagram_jumbotron").resizable({ handles: 's', minHeight: 100 });
    $("#toolbar-body").resizable({ handles: 'w', maxWidth: $('#diagram_jumbotron').width()-60 });
    $("#toolbar-body").on('resize', function(event, ui) {
        //updateSettings();
    });
    // reseize event to resize canvas and toolbars
    $('#diagram_jumbotron').on('resize', function(event, ui) {
        resizeTables();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            settings[activeToolbar] = Math.round($('#toolbar-body').width());
            settings.diagram = Math.round($('#diagram_jumbotron').height());
            updateSettings();
            resizeCanvas();
        }, 100);
    });
    window.addEventListener('resize', function() {
        resizeTables();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            resizeCanvas();
        }, 100);
    }, false);
    $("#message-input-box").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            sendChatMessage($("#message-input-box").val(), activeChannel);
            $("#message-input-box").val('');
        }
    });
    // load settings from cookie
    loadSettings();
    resizeTables();
    resizeCanvas();
});

// publically accessible functions
module.exports = {
    deleteObject: deleteObject,
    saveRow: saveRow,
    deleteRow: deleteRow,
    deleteRowConfirm: deleteRowConfirm,
};
