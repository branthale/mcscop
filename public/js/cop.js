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
var toastr = require('toastr');
global.mission_id = getParameterByName('mission');

// ---------------------------- PERMISSIONS & BUTTONS ----------------------------------
if (!permissions)
    permissions = [];
var diagram_rw = false;
var tasks_rw = false;
var details_rw = false;

// bind buttons
if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_diagram') !== -1) {
    diagram_rw = true;
    $('#propName').prop('disabled', false);
    $('#newObjectButton').prop('disabled', false).click(newObject);
    $('#propFillColor').prop('disabled', false);
    $('#propStrokeColor').prop('disabled', false);
    $('#lockObject').prop('disabled', false);
    $('#moveUp').prop('disabled', false).click(moveUp);
    $('#moveDown').prop('disabled', false).click(moveDown);
    $('#moveToFront').prop('disabled', false).click(moveToFront);
    $('#moveToBack').prop('disabled', false).click(moveToBack);
    $('#objectWidth').prop('disabled', false);
    $('#objectHeight').prop('disabled', false);
    $('#insertObjectButton').prop('disabled', false).click(insertObject);
    $('#deleteObjectButton').prop('disabled', false).click(deleteObjectConfirm);;
}
$('#play').click(function() { toggleAnimateSlider(); });
$('#toolsTab').click(function() { toggleToolbar('tools'); });
$('#tasksTab').click(function() { toggleToolbar('tasks'); });
$('#notesTab').click(function() { toggleToolbar('notes'); });
$('#filesTab').click(function() { toggleToolbar('files'); });
$('#eventsTab').click(function() { toggleTable('events'); });
$('#opnotesTab').click(function() { toggleTable('opnotes'); });
$('#chatTab').click(function() { toggleTable('chat'); });
$('#settingsTab').click(function() { toggleTable('settings'); });
$('#propName').change(function() { updatePropName(this.value) });
$('#lockObject').change(function() { toggleObjectLock($('#lockObject').is(':checked')) });
$('#objectWidth').change(function() { setObjectSize(); });
$('#objectHeight').change(function() { setObjectSize(); });
$('#zoomInButton').click(function() { zoomIn(); });
$('#zoomOutButton').click(function() { zoomOut(); });
$('#objectSearch').change(function() { objectSearch(this.value) });
$('#nextObjectSearch').click(function() { nextObjectSearch(); });
$('#prevObjectSearch').click(function() { prevObjectSearch(); });
$('#closeToolbarButton').click(closeToolbar);
$('#cancelLinkButton').click(cancelLink);
$('#editDetailsButton').click(function() { editDetails(); });
$('#newNoteButton').click(function() { newNote(); });
$('#downloadEventsButton').click(function() { downloadEvents(); });
$('#downloadDiagramButton').click(function() { downloadDiagram(this); });
$('#downloadOpnotesButton').click(function() { downloadOpnotes(); });

if (permissions.indexOf('all') !== -1 || permissions.indexOf('modify_tasks') !== -1) {
    tasks_rw = true;
    $('#hostTasks').prop('disabled', false);
    $('#networkTasks').prop('disabled', false);
    $('#ccirs').prop('disabled', false);
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

// toastr
var notifSound = null;
toastr.options = {
  "closeButton": true,
  "debug": false,
  "newestOnTop": false,
  "progressBar": false,
  "positionClass": "toast-top-center",
  "preventDuplicates": true,
  "onclick": null,
  "showDuration": "300",
  "hideDuration": "1000",
  "timeOut": "5000",
  "extendedTimeOut": "1000",
  "showEasing": "swing",
  "hideEasing": "linear",
  "showMethod": "fadeIn",
  "hideMethod": "fadeOut"
}

// ---------------------------- FABRIC CANVASES ----------------------------------
MAXWIDTH=2000;
MAXHEIGHT=2000;
fabric.Object.prototype.originX = 'left';
fabric.Object.prototype.originY = 'top';
//fabric.Group.prototype.hasControls = false;
fabric.Object.prototype.transparentCorners = false;
fabric.Object.prototype.cornerSize = 7;
fabric.Object.prototype.objectCaching = true;
fabric.Object.prototype.noScaleCache = false;
fabric.Object.NUM_FRACTION_DIGITS = 10;
fabric.Object.prototype.lockScalingFlip = true;
fabric.Group.prototype.hasControls = false;
fabric.Group.prototype.lockScalingX = true;
fabric.Group.prototype.lockScalingY = true;
var canvas = new fabric.Canvas('canvas', {
    preserveObjectStacking: true,
    renderOnAddRemove: false,
    enableRetinaScaling: false,
    uniScaleTransform: true,
    width: MAXWIDTH,
    height: MAXHEIGHT
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
var userSelect = [{_id:'', username:''}];
var roleSelect = [{_id:'', name:''}];
var dateSlider = null;
var objectsLoaded = null;
var updatingObject = false;
var socket;
var toolbarState = false;
var firstNode = null;
var hSnap = false;
var vSnap = false;
var SVGCache = {};
var tempLinks = [];
var guides = {};
var objectCache = {};
var resizeTimer = null;
var updateSettingsTimer = null;
var objectMovingTimer = null;
var sliderTimer = null;
var activeToolbar = null;
var activeTable = 'events';
var activeChannel = 'log';
var chatPosition = {};
var objectSearchResults = [];
var objectSearchPtr = null;
var firstChat = true;
var unreadMessages = {};
var cellEdit = null;
var cellEditRow = null;
var clickComplete = false;
var lastClick = null;
var msgId = 0;
var pendingMsg = [];
global.lastselection = {id: null, iRow: null, iCol: null};
var lastFillColor = '#000000';
var lastStrokeColor = '#ffffff';
global.addingRow = false;
var windowManager = null;
var canvasClipboard = [];

var wsdb;
var openDocs = {};
var shareDBConnection;
sharedb.types.register(richText.type);

//https://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-only-if-necessary
Number.prototype.round = function(places) {
    return +(Math.round(this + "e+" + places)  + "e-" + places);
}

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
// this is used to allow shapes to resize and retain a 1px border
canvas.observe('object:modified', function (e) {
    if (e.target !== undefined && e.target.resizeToScale)
        e.target.resizeToScale();
});

// ---------------------------- Various Helper Functions  ----------------------------------
// convert hex to rgb
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

// zero pad a number
function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
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

// convert JSON from jqgrids to csv for export
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
 
// ---------------------------- Canvas Events  ----------------------------------
$('#diagram').mousedown(startPan);

canvas.on('object:rotating', function(options) {
    var step = 5;
    options.target.set({
        angle: Math.round(options.target.angle / step) * step,
    });
});

function objectMoving(o, snap) {
    var grid = 1;
    o.set({
        left: Math.round(o.left / grid) * grid,
        top: Math.round(o.top / grid) * grid
    });
    var zoom = canvas.getZoom();
    var tmod = 0;
    var lmod = 0;
    if (canvas.getActiveObjects().length > 1) {
        tmod = o.top + o.height/2;
        lmod = o.left + o.width/2;
    }
    drawAlignmentGuides(o, snap);
    o = canvas.getActiveObjects();
    for (var i = 0; i < o.length; i++) {
        o[i].dirty = true;
        for (var j = 0; j < o[i].children.length; j++) {
            if (o[i].children[j].objType === 'name') {
                o[i].children[j].set('top', o[i].top + tmod + o[i].height * o[i].scaleY + 4);
                o[i].children[j].set('left', o[i].left + lmod + (o[i].width * o[i].scaleX)/2);
                o[i].children[j].setCoords();
            } else if (o[i].children[j].objType === 'link') {
                drawLink(o[i].children[j]);
            }
        }
    }
}

// called when an object is moving on the canvas
canvas.on('object:moving', function(options) {
    objectMoving(options.target, 2);
});

canvas.on('object:scaling', function(options) {
    var o = options.target;
    var tmod = 0;
    var lmod = 0;
    if (canvas.getActiveObjects().length > 1) {
        tmod = options.target.top + options.target.height/2;
        lmod = options.target.left + options.target.width/2;
    }
    $('#objectWidth').val(Math.round(o.width * o.scaleX));
    $('#objectHeight').val(Math.round(o.height * o.scaleY));
    drawAlignmentGuides(o, 1);
    var o = canvas.getActiveObjects();
    for (var i = 0; i < o.length; i++) {
        o[i].dirty = true;
        for (var j = 0; j < o[i].children.length; j++) {
            if (o[i].children[j].objType === 'name') {
                o[i].children[j].set('top', o[i].top + tmod + o[i].height * o[i].scaleY + 4);
                o[i].children[j].set('left', o[i].left + lmod + (o[i].width * o[i].scaleX)/2);
                o[i].children[j].setCoords();
            } else if (o[i].children[j].objType === 'link') {
                drawLink(o[i].children[j]);
            }
        }
    }
});

function objectModified(o) {
    var tmod = 0;
    var lmod = 0;
    if (o.objType === 'icon') {
        o.set({scaleX: Math.round(o.width * o.scaleX) / o.width, scaleY: Math.round(o.height * o.scaleY) / o.height});
    } else if (o.objType === 'shape') {
        o.set({width: Math.round(o.width), height: Math.round(o.height)});
    }
    o.set({left: Math.round(o.left), top: Math.round(o.top)});
    if (canvas.getActiveObjects().length > 1) {
        tmod = o.top + o.height/2;
        lmod = o.left + o.width/2;
    }

    // remove the guides
    for (var k in guides) {
        if (guides.hasOwnProperty(k)) {
            canvas.remove(guides[k]);
            delete guides[k];
        }
    }

    // compile changes for db
    o = canvas.getActiveObjects();
    var args = []
    for (var i = 0; i < o.length; i++) {
        var z = canvas.getObjects().indexOf(o[i]) / 2;
        if (o[i].objType === 'link')
            args.push({_id: o[i]._id, x:0, y:0, z: z, scale_x:0, scale_y: 0, rot: 0});
        else if (o[i].objType === 'icon') {
            args.push({_id: o[i]._id, x: lmod + o[i].left, y: tmod + o[i].top, z: z, scale_x: o[i].scaleX, scale_y: o[i].scaleY, rot: o[i].angle});
        }
        else if (o[i].objType === 'shape')
            args.push({_id: o[i]._id, x: lmod + o[i].left, y: tmod + o[i].top, z: z, scale_x: o[i].width, scale_y: o[i].height, rot: o[i].angle});
    }

    // update minimap
    updateMinimapBg();

    // send changes to db
    socket.send(JSON.stringify({act: 'move_object', arg: args, msgId: msgHandler()}));
}

canvas.on('object:modified', function(options) {
    objectModified(options.target);
});

// actions when double clicking on the canvas
fabric.util.addListener(canvas.upperCanvasEl, 'dblclick', function (e) {
    var o = canvas.findTarget(e);
    if (canvas.getActiveObjects().length === 1 && !creatingLink) {
        if (o.objType !== undefined) {
            $('#propID').val(o._id);
            $('#propFillColor').val(o.fill);
            $('#propFillColor').data('paletteColorPickerPlugin').reload();
            $('#lockObject').prop('checked', o.locked);
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

// called after a selection is made on the canvas
canvas.on('selection:created', function(options) {
    if (canvas.getActiveObjects().length > 1) {
        closeToolbar();
        for (var i = options.selected.length - 1; i >= 0; i--) {
            if (options.selected[i].objType === 'link' || options.selected[i].locked) {
                canvas.getActiveObject().removeWithUpdate(options.selected[i]);
            }
        }
    }
});

// called when an existing selection is changed on the canvas (ie more icons added / removed)
canvas.on('selection:updated', function(options) {
    updateSelection(options);
});

// called when an object is selected
canvas.on('object:selected', function(options) {
    updateSelection(options);
});

// called before everything on the canvas is deslected
canvas.on('before:selection:cleared', function(options) {
    if (!updatingObject)// && canvas.getActiveObjects().length < 1)
        closeToolbar();
});

// updates the two sides of all links
// necessary because sometimes items are added / removed before or after the icon is rx'ed
function updateLinks() {
    for (var i = 0; i < canvas.getObjects().length; i++) {
        var link = canvas.item(i);
        if (link.objType && link.objType === 'link') {
            updateLink(link);
        }
    }
}

// worker portion of above
function updateLink(link) {
    var foundFrom = false;
    var foundTo = false;
    for (var j = 0; j < canvas.getObjects().length; j++) {
        var jo = canvas.item(j);
        if (!foundFrom && jo._id == link.fromId) {
            link.fromObj = jo;
            if (jo.children.indexOf(link) === -1)
                jo.children.push(link);
            foundFrom = true;
        } else if  (!foundTo && jo._id == link.toId) {
            link.toObj = jo;
            if (jo.children.indexOf(link) === -1)
                jo.children.push(link);
            foundTo = true;
        }

    }
    if (foundFrom && foundTo)
        drawLink(link);
    return (foundFrom && foundTo);
}

function getObjCtr(o) {
    var x = (o.width * o.scaleX) / 2 + o.left;
    var y = (o.height * o.scaleY) / 2 + o.top;
    return {x: x, y:y};
}

// ---------------------------- Links and Guides  ----------------------------------
function drawAlignmentGuides(o, snap) {
    var vSnap = snap;
    var hSnap = snap;
    var zoom = canvas.getZoom();
    // alignment markers
    var hAligned = false;
    var vAligned = false;
    var tAligned = false;
    var bAligned = false;
    var lAligned = false;
    var rAligned = false;
    var hSpaced = false;
    var vSpaced = false;
    var hAlignedObjects = [];
    var vAlignedObjects = [];
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).isOnScreen() && (canvas.item(i).objType && canvas.item(i).objType === 'icon' || canvas.item(i).objType && canvas.item(i).objType === 'shape') && canvas.getActiveObjects().indexOf(canvas.item(i)) === -1) {
            // middle vert alignment guide
            if (Math.round(getObjCtr(canvas.item(i)).x) <= Math.ceil(getObjCtr(o).x) + vSnap && Math.round(getObjCtr(canvas.item(i)).x) >= Math.floor(getObjCtr(o).x) - vSnap) {
                if (canvas.item(i).top + canvas.item(i).height * canvas.item(i).scaleY < o.top || canvas.item(i).top > o.top + o.height * o.scaleY)
                    vAlignedObjects.push(canvas.item(i));

                if (!vAligned) {
                    if (vSnap > 1)
                        o.set({
                            left: Math.round(canvas.item(i).left + (canvas.item(i).width * canvas.item(i).scaleX) / 2 - (o.width * o.scaleX) / 2)
                        });
                    vAligned = true;
                    vSnap = 0;
                    if (!guides.vGuide) {
                        var line = new fabric.Line([getObjCtr(o).x, -canvas.viewportTransform[5] / zoom, getObjCtr(o).x, (-canvas.viewportTransform[5] + canvas.height) / zoom], {
                            objType: 'guide',
                            stroke: '#66bfff',
                            strokeColor: '#66bfff',
                            strokeDashArray: [2,2],
                            strokeWidth: 1,
                            selectable: false,
                            evented: false
                        });
                        canvas.add(line);
                        guides.vGuide = line;
                    }
                }
            }
            // left alignment mark
            if (!lAligned && (Math.round(canvas.item(i).left) <= Math.round(o.left) + vSnap && Math.round(canvas.item(i).left) >= Math.round(o.left) - vSnap)) {
                if (vSnap > 1 && !vAligned)
                    o.set({
                        left: canvas.item(i).left
                    });
                lAligned = true;
                vSnap = 0;
                if (!guides.lGuide) {
                    var line = new fabric.Line([o.left, -canvas.viewportTransform[5] / zoom, o.left, (-canvas.viewportTransform[5] + canvas.height) / zoom], {
                        objType: 'guide',
                        stroke: '#bf66ff',
                        strokeColor: '#bf66ff',
                        strokeDashArray: [2,2],
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    canvas.add(line);
                    guides.lGuide = line;
                }
            }
            // right alignment mark
            if (!rAligned && (Math.round(canvas.item(i).left + canvas.item(i).width * canvas.item(i).scaleX) <= Math.round(o.left + o.width * o.scaleX) + vSnap && Math.round(canvas.item(i).left + canvas.item(i).width * canvas.item(i).scaleX) >= Math.round(o.left + o.width * o.scaleX) - vSnap)) {
                if (vSnap > 1 && !vAligned && !lAligned)
                    o.set({
                        left: canvas.item(i).left + canvas.item(i).width * canvas.item(i).scaleX - (o.width * o.scaleX)
                    });
                rAligned = true;
                if (!guides.rGuide) {
                    var line = new fabric.Line([o.left + (o.width * o.scaleX) + 1, -canvas.viewportTransform[5] / zoom, o.left + (o.width * o.scaleX) + 1, (-canvas.viewportTransform[5] + canvas.height) / zoom], {
                        objType: 'guide',
                        stroke: '#bf66ff',
                        strokeColor: '#bf66ff',
                        strokeDashArray: [2,2],
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    canvas.add(line);
                    guides.rGuide = line;
                }
            }
            // middle horiz alignment guide
            if (Math.round(getObjCtr(canvas.item(i)).y) <= Math.round(getObjCtr(o).y) + hSnap && Math.round(getObjCtr(canvas.item(i)).y) >= Math.round(getObjCtr(o).y) - hSnap) {
                if (canvas.item(i).left + canvas.item(i).width * canvas.item(i).scaleX < o.left || canvas.item(i).left > o.left + o.width * o.scaleX)
                    hAlignedObjects.push(canvas.item(i));
                if (!hAligned) {
                    if (hSnap > 1)
                        o.set({
                            top: Math.round(canvas.item(i).top + (canvas.item(i).height * canvas.item(i).scaleY) / 2 - (o.height * o.scaleY) / 2)
                        });
                    hAligned = true;
                    hSnap = 0;
                    if (!guides.hGuide) {
                        var line = new fabric.Line([-canvas.viewportTransform[4] / zoom, getObjCtr(o).y, (-canvas.viewportTransform[4] + canvas.width) / zoom, getObjCtr(o).y], {
                            objType: 'guide',
                            stroke: '#66bfff',
                            strokeColor: '#66bfff',
                            strokeDashArray: [2,2],
                            strokeWidth: 1,
                            selectable: false,
                            evented: false
                        });
                        canvas.add(line);
                        guides.hGuide = line;
                    }
                }
            }
            // top alignment guide
            if (!tAligned && (Math.round(canvas.item(i).top) <= Math.round(o.top) + hSnap && Math.round(canvas.item(i).top) >= Math.round(o.top) - hSnap)) {
                if (hSnap > 1)
                    o.set({
                        top: canvas.item(i).top
                    });
                hSnap = 0;
                tAligned = true;
                if (!guides.tGuide) {
                    var line = new fabric.Line([-canvas.viewportTransform[4] / zoom, o.top, (-canvas.viewportTransform[4] + canvas.width) / zoom, o.top], {
                        objType: 'guide',
                        stroke: '#bf66ff',
                        strokeColor: '#bf66ff',
                        strokeDashArray: [2,2],
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    canvas.add(line);
                    guides.tGuide = line;
                }
            }
            // bottom alignment guide
            if (!bAligned && (Math.round(canvas.item(i).top + canvas.item(i).height * canvas.item(i).scaleY) <= Math.round(o.top + (o.height * o.scaleY)) + hSnap && Math.round(canvas.item(i).top + canvas.item(i).height * canvas.item(i).scaleY) >= Math.round(o.top + (o.height * o.scaleY)) - hSnap)) {
                if (hSnap > 1)
                    o.set({
                        top: canvas.item(i).top + canvas.item(i).height * canvas.item(i).scaleY - o.height * o.scaleY
                    });
                hSnap = 0;
                bAligned = true;
                if (!guides.bGuide) {
                    var line = new fabric.Line([-canvas.viewportTransform[4] / zoom, o.top + (o.height * o.scaleY) + 1, (-canvas.viewportTransform[4] + canvas.width) / zoom, o.top + (o.height * o.scaleY) + 1], {
                        objType: 'guide',
                        stroke: '#bf66ff',
                        strokeColor: '#bf66ff',
                        strokeDashArray: [2,2],
                        strokeWidth: 1,
                        selectable: false,
                        evented: false
                    });
                    canvas.add(line);
                    guides.bGuide = line;
                }
            }
        }
    }
    if (hAlignedObjects.length > 1) {
        hAlignedObjects.push(o);
        hAlignedObjects.sort(function(a,b) {return (a.left > b.left) ? 1 : ((b.left <= a.left) ? -1 : 0);} );
        var idx = hAlignedObjects.indexOf(o);
        var alignedIcons = null;
        // right
        if (idx > 1 && Math.round(getObjCtr(hAlignedObjects[idx - 2]).x) - Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) >= Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx]).x) - vSnap && Math.round(getObjCtr(hAlignedObjects[idx - 2]).x) - Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) <= Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx]).x) + vSnap) {
            o.set({
                left: Math.round(getObjCtr(hAlignedObjects[idx - 1]).x - (getObjCtr(hAlignedObjects[idx - 2]).x) + Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) - o.width / 2)
            });
            alignedIcons = [idx - 2, idx - 1, idx];
            hSpaced = true;
        } else if (idx < hAlignedObjects.length - 2 && Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 2]).x) >= Math.round(getObjCtr(hAlignedObjects[idx]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) - vSnap && Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 2]).x) <= Math.round(getObjCtr(hAlignedObjects[idx]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) + vSnap) {
            o.set({
                left: Math.round(getObjCtr(hAlignedObjects[idx + 1]).x - (Math.round(getObjCtr(hAlignedObjects[idx + 2]).x) - getObjCtr(hAlignedObjects[idx + 1]).x) - o.width / 2)
            });
            alignedIcons = [idx, idx + 1, idx + 2];
            hSpaced = true;
        } else if (idx > 0 && idx < hAlignedObjects.length - 1 && Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx]).x) >= Math.round(getObjCtr(hAlignedObjects[idx]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) - vSnap && hAlignedObjects.length - 1 && Math.round(getObjCtr(hAlignedObjects[idx - 1]).x) - Math.round(getObjCtr(hAlignedObjects[idx]).x) <= Math.round(getObjCtr(hAlignedObjects[idx]).x) - Math.round(getObjCtr(hAlignedObjects[idx + 1]).x) + vSnap) {
            o.set({
                left: Math.round(getObjCtr(hAlignedObjects[idx + 1]).x - (getObjCtr(hAlignedObjects[idx + 1]).x - (getObjCtr(hAlignedObjects[idx - 1]).x)) / 2 - o.width / 2)
            });
            alignedIcons = [idx - 1, idx, idx + 1];
            hSpaced = true;
        }
        if (alignedIcons && !guides.hSGuide) {
            var hSGuide = [];
            var line = new fabric.Line([getObjCtr(hAlignedObjects[alignedIcons[0]]).x, getObjCtr(hAlignedObjects[alignedIcons[0]]).y - 10, getObjCtr(hAlignedObjects[alignedIcons[0]]).x, getObjCtr(hAlignedObjects[alignedIcons[0]]).y + 10], { objType: 'guide', stroke: '#ff1111', strokeColor: '#ff1111', strokeDashArray: [2,2], strokeWidth: 2, selectable: false, evented: false });
            hSGuide.push(line);
            line = new fabric.Line([getObjCtr(hAlignedObjects[alignedIcons[1]]).x, getObjCtr(hAlignedObjects[alignedIcons[1]]).y - 10, getObjCtr(hAlignedObjects[alignedIcons[1]]).x, getObjCtr(hAlignedObjects[alignedIcons[1]]).y + 10], { objType: 'guide', stroke: '#ff1111', strokeColor: '#ff1111', strokeDashArray: [2,2], strokeWidth: 2, selectable: false, evented: false });
            hSGuide.push(line);
            line = new fabric.Line([getObjCtr(hAlignedObjects[alignedIcons[2]]).x, getObjCtr(hAlignedObjects[alignedIcons[2]]).y - 10, getObjCtr(hAlignedObjects[alignedIcons[2]]).x, getObjCtr(hAlignedObjects[alignedIcons[2]]).y + 10], { objType: 'guide', stroke: '#ff1111', strokeColor: '#ff1111', strokeDashArray: [2,2], strokeWidth: 2, selectable: false, evented: false });
            hSGuide.push(line);
            line = new fabric.Line([getObjCtr(hAlignedObjects[alignedIcons[0]]).x, getObjCtr(hAlignedObjects[alignedIcons[0]]).y, getObjCtr(hAlignedObjects[alignedIcons[2]]).x, getObjCtr(hAlignedObjects[alignedIcons[2]]).y], { objType: 'guide', stroke: '#ff1111', strokeColor: '#ff1111', strokeDashArray: [2,2], strokeWidth: 2, selectable: false, evented: false });
            hSGuide.push(line);
            guides.hSGuide = new fabric.Group(hSGuide);
            canvas.add(guides.hSGuide);
        }
    }
    if (!lAligned && guides.lGuide) {
        canvas.remove(guides.lGuide);
        delete guides.lGuide;
    }
    if (!rAligned && guides.rGuide) {
        canvas.remove(guides.rGuide);
        delete guides.rGuide;
    }
    if (!bAligned && guides.bGuide) {
        canvas.remove(guides.bGuide);
        delete guides.bGuide;
    }
    if (!tAligned && guides.tGuide) {
        canvas.remove(guides.tGuide);
        delete guides.tGuide;
    }
    if (!hAligned && guides.hGuide) {
        canvas.remove(guides.hGuide);
        delete guides.hGuide;
    }
    if (!vAligned && guides.vGuide) {
        canvas.remove(guides.vGuide);
        delete guides.vGuide;
    }
    if (!hSpaced && guides.hSGuide) {
        canvas.remove(guides.hSGuide);
        delete guides.hSGuide;
    }
    return;
}

// render all links including temporary links for event tracking
function drawLinks() {
    for (var i = 0; i < canvas.getObjects().length; i++) {
        var link = canvas.item(i);
        if (link.objType && link.objType === 'link') {
            drawLink(link);
        }
    }
    for (var i = 0; i < tempLinks.length; i++) {
        if (tempLinks[i].objType === 'link') {
            tempLinks[i].set({ 'x1': tempLinks[i].getObjCtr(from).x, 'y1': tempLinks[i].getObjCtr(from).y });
            tempLinks[i].set({ 'x2': tempLinks[i].getObjCtr(to).x, 'y2': tempLinks[i].getObjCtr(to).y });
        } else if (tempLinks[i].objType === 'shape') {
            tempLinks[i].set({top: tempLinks[i].dad.top - 7.5, left: tempLinks[i].dad.left - 7.5});
        }
    }
}

// draw a specific link
function drawLink(link) {
    if (link.toObj && link.fromObj) {
        var fromAbs = link.fromObj.calcTransformMatrix();
        var toAbs = link.toObj.calcTransformMatrix();
        link.set({ 'x1': fromAbs[4], 'y1': fromAbs[5] });
        link.set({ 'x2': toAbs[4], 'y2': toAbs[5] });
        link.setCoords();
        for (var j = 0; j < link.children.length; j++) {
            if (link.children[j].objType === 'name') {
                link.children[j].set({ 'left': getObjCtr(link).x, 'top': getObjCtr(link).y });
                var angle = Math.atan2((link.y1 - link.y2), (link.x1 - link.x2)) * (180/Math.PI);
                if(Math.abs(angle) > 90)
                    angle += 180;
                link.children[j].set({'angle': angle});
                link.children[j].setCoords();
            }
        }
    }
}

// ---------------------------- Toolbar Stuff  ----------------------------------
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
                if (canvas.getActiveObjects().length > 1)
                    $("#toolbar-body").addClass("disabled-div");
                else
                    $("#toolbar-body").removeClass("disabled-div");
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
                if (objType === 'link') {
                    $('#sizeObject').hide();
                    $('#lockObjectGroup').hide();
                    $('#propFillColorSpan').hide();
                } else {
                    $('#sizeObject').show();
                    $('#lockObjectGroup').show();
                }
                var index = $('#propObjectGroup a[href="#tabs-' + objType + '"]').parent().index();
                $('#moveObject').show();
                $('#propObjectGroup').tabs('enable', index);
                $('#propObjectGroup').tabs('option', 'active', index);
            } else if (canvas.getActiveObject() === undefined || canvas.getActiveObject() === null) {
                $("#toolbar-body").removeClass("disabled-div");
                $('#toolbarTitle').html('New Object');
                $('#propID').val('');
                $('#propNameGroup').show();
                $('#propName').val('');
                $('#propFillColor').val(lastFillColor);
                $('#propFillColor').data('paletteColorPickerPlugin').reload();
                $('#propStrokeColor').val(lastStrokeColor);
                $('#propStrokeColor').data('paletteColorPickerPlugin').reload();
                $('#lockObject').prop('checked', false);
                $('#propType').val('icon');
                $('#prop-icon').val('00-000-icon-hub.png');
                $('#prop-icon').data('picker').sync_picker_with_select();
                $('#propObjectGroup').tabs('enable');
                $('#propObjectGroup').tabs('option', 'active', 0);
                $('#moveObject').hide();
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

// update the toolbox when a new icon is clicked
function updateSelection(options) {
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
                        lastFillColor = $('#propFillColor').val();
                        lastFillColor = $('#propStrokeColor').val();
                        socket.send(JSON.stringify({act: 'insert_object', arg: {name:$('#propName').val(), type: 'link', image: $('#prop-link').val().replace('.png','.svg'), stroke_color:$('#propStrokeColor').val(), fill_color:$('#propFillColor').val(), obj_a: firstNode._id, obj_b: o._id, x: 0, y: 0, z: 0, locked: $('#lockObject').is(':checked')}, msgId: msgHandler()}));
                        firstNode = null;
                        creatingLink = false;
                    }
                }
            } else {
                $('#propID').val(o._id);
                $('#propFillColor').val(o.fill);
                $('#propFillColor').data('paletteColorPickerPlugin').reload();
                $('#propStrokeColor').val(o.stroke);
                $('#propStrokeColor').data('paletteColorPickerPlugin').reload();
                $('#objectWidth').val(Math.round(o.width * o.scaleX));
                $('#objectHeight').val(Math.round(o.height * o.scaleY));
                $('#lockObject').prop('checked', o.locked);
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
}

function newNote() {
    bootbox.prompt('Note name?', function(name) {
        socket.send(JSON.stringify({act: 'insert_note', arg: {name: name}, msgId: msgHandler()}));
    });
}

function newObject() {
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    openToolbar('tools');
}

function cancelMenu() {
    $(window).off('contextmenu', cancelMenu);
    return false;
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

function updatePropName(name) {
    var o = canvas.getActiveObject();
    if (o) {
        for (var i = 0; i < o.children.length; i++) {
            if (o.children[i].objType === 'name')
                o.children[i].text = name;
        }
        changeObject(o);
        canvas.requestRenderAll();
    }
}

// grab icons from the server
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

function editDetails(id, name) {
    var rw = false;
    if (!name)
        name = '';
    if (!id && canvas.getActiveObject()) {
        if (details_rw)
            rw = true;
        id = 'm-' + mission_id + 'd-' + canvas.getActiveObject()._id;
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
            openDocs[id] = shareDBConnection.get('sharedb', id);
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
                                ['link', 'image', 'code-block']
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

// check if shapes are chached before loading canvas
function checkIfShapesCached(msg) {
    if (objectsLoaded.length == 0) {
        console.log('cached');
        for (var o in msg) {
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

// check if objects are all added to the canvas before first draw
// we're basically ready after this
function checkIfObjectsLoaded() {
    if (objectsLoaded.length == 0) {
        console.log('objects loaded');
        $('#modal').modal('hide');
        //FIXME
        // objects loaded, update the events tracker
        $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
        $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
        $('#events2').jqGrid().trigger('reloadGrid');
        updateLinks();
        updateMinimapBg();
        canvas.requestRenderAll();
        canvas.renderOnAddRemove = true;
    } else {
        setTimeout(checkIfObjectsLoaded, 50);
    }
}

// ---------------------------- CHAT / LOG WINDOW  ----------------------------------
function notification(msg) {
    notifSound.play();
    if (!("Notification" in window) || Notification.permission === 'denied') {
        toastr.info(msg.text, msg.username)
    }
    else if (Notification.permission === 'granted') {
        var notification = new Notification(msg.username, {
            icon: 'images/avatars/' + msg.user_id + '.png',
            body: msg.text
        });
    }
    else {
        Notification.requestPermission(function (permission) {
            if (!('permission' in Notification)) {
                Notification.permission = permission;
            }
            if (permission === 'granted') {
                var notification = new Notification(msg);
            }
        });
    }
}

function addChatMessage(messages, bulk) {
    if (!bulk)
        bulk = false;
    for (var i = 0; i < messages.length; i++) {
        if (!earliest_messages[messages[i].channel])
            earliest_messages[messages[i].channel] = 2147483647000
        var pane = $('#' + messages[i].channel);
        var ts = messages[i].timestamp;
        if (ts < earliest_messages[messages[i].channel]) {
            earliest_messages[messages[i].channel] = ts;
        }
        if (messages[i].prepend)
            pane.prepend('<div class="message-wraper"><div class="message"><div class="message-gutter"><img class="message-avatar" src="images/avatars/' + messages[i].user_id + '.png"/></div><div class="message-content"><div class="message-content-header"><span class="message-sender">' + messages[i].username + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + messages[i].text + '</span></div></div>');
        else {
            var atBottom = $('#' + messages[i].channel)[0].scrollHeight - Math.round($('#' + messages[i].channel).scrollTop()) == $('#' + messages[i].channel).outerHeight();
            var newMsg = $('<div class="message-wrapper"><div class="message"><div class="message-gutter"><img class="message-avatar" src="images/avatars/' + messages[i].user_id + '.png"/></div><div class="message-content"><div class="message-content-header"><span class="message-sender">' + messages[i].username + '</span><span class="message-time">' + epochToDateString(ts) + '</span></div><span class="message-body">' + messages[i].text + '</span></div></div>');
            if (!bulk && activeChannel === messages[i].channel)
                newMsg.hide();
            newMsg.appendTo(pane);
            if (!bulk && messages[i].channel !== 'log' && user_id != messages[i].user_id) {
                if (messages[i].text.search('@' + username) >= 0 || messages[i].text.search('@alert') >= 0) {
                    notification(messages[i]);
                }
            }
            if (!bulk && messages[i].channel !== 'log' && (activeTable !== 'chat' || activeChannel !== messages[i].channel)) {
                if (!unreadMessages[messages[i].channel]) {
                    $('.newMessage').removeClass('newMessage');
                    $('.newMessageLabel').remove();
                    unreadMessages[messages[i].channel] = 1;
                    newMsg.addClass('newMessage');
                    newMsg.append('<div class="newMessageLabel">New Messages</div>');
                }
                else
                    unreadMessages[messages[i].channel]++;
                $('#unread-' + messages[i].channel).text(unreadMessages[messages[i].channel]).show();
                $('#chatTab').css('background-color', '#ff6060');
            }
            if (!bulk && activeChannel === messages[i].channel)
                newMsg.fadeIn('fast');
            if (atBottom)
                $('#' + messages[i].channel).scrollTop($('#' + messages[i].channel)[0].scrollHeight);
        }
        if (messages[i].more)
            pane.prepend('<div id="get-more-messages"><span onClick="cop.getMoreMessages(\'' + messages[i].channel + '\')">Get more messages.</span></div>');
    }
}

// called when a user requests more history from teh current chat
function getMoreMessages(channel) {
    $('#get-more-messages').remove();
    socket.send(JSON.stringify({act:'get_old_chats', arg: {channel: channel, start_from: earliest_messages[channel]}, msgId: msgHandler()}));
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

// ---------------------------- NOTES TREE ----------------------------------
function createNotesTree(arg) {
    $('#notes')
        .on('select_node.jstree', function(e, data) {
            var name = '';
            if (data.node && data.node.text)
                name = data.node.text;
            if (data.node.li_attr.isLeaf) {
                editDetails('m-' + mission_id + '-n-' + data.selected[0], name);
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
                        'newnote': {
                            'separator_before': false,
                            'separator_after': false,
                            'label': 'New Note',
                            'action': function (obj) {
                                var _node = node;
                                bootbox.prompt('Note name?', function(name) {
                                    socket.send(JSON.stringify({act: 'insert_note', arg: {name: name}, msgId: msgHandler()}));
                                });
                            }
                        },
                        'renamenote': {
                            'separator_before': false,
                            'separator_after': false,
                            'label': 'Rename',
                            'action': function (obj) {
                                var _node = node;
                                bootbox.prompt('Rename note to?', function(name) {
                                    socket.send(JSON.stringify({act: 'rename_note', arg: {id: node.id, name: name}, msgId: msgHandler()}));
                                });
                            }
                        },
                        'del': {
                            'separator_before': false,
                            'separator_after': false,
                            'label': 'Delete Note',
                            'action': function (obj) {
                                socket.send(JSON.stringify({act: 'delete_note', arg: {id: node.id}, msgId: msgHandler()}));
                            }
                        }
                    }
                }
            }
        });
}

// ---------------------------- Minimap Functions ----------------------------------
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
            minimapBgCtx.fillRect((MAXWIDTH + canvas.item(i).left) * scaleX, (MAXHEIGHT + canvas.item(i).top) * scaleY, 2, 2);
        }
    }
}

// ---------------------------- OBJECT SEARCHING / FOCUSING ----------------------------------
function objectSearch(s) {
    objectSearchResults = [];
    objectSearchPtr = -1;
    for (var i = 0; i < canvas.getObjects().length; i++) {
        if (canvas.item(i).name_val !== undefined && canvas.item(i).name_val.toLowerCase().indexOf(s.toLowerCase()) !== -1) {
            objectSearchResults.push(canvas.item(i));
        }
    }
    nextObjectSearch();
}

function focusObject(o) {
    var center = getObjCtr(o);
    center.x = center.x * canvas.getZoom() - canvas.width / 2 + $('#toolbar').width() / 2;
    center.y = center.y * canvas.getZoom() - canvas.height / 2;
    canvas.absolutePan(center);
    updateMinimap();
    updateSettings();
}

function nextObjectSearch() {
    if (objectSearchResults.length > 0) {
        objectSearchPtr ++;
        if (objectSearchPtr >= objectSearchResults.length || objectSearchPtr < 0)
            objectSearchPtr = 0;
        $('#foundCount').text(objectSearchPtr + 1 + '/' + objectSearchResults.length);
        $('#foundCount').show();
        focusObject(objectSearchResults[objectSearchPtr]);
        canvas.setActiveObject(objectSearchResults[objectSearchPtr]);
    } else {
        $('#foundCount').hide();
    }
}

function prevObjectSearch() {
    if (objectSearchResults.length > 0) {
        objectSearchPtr --;
        if (objectSearchPtr < 0)
            objectSearchPtr = objectSearchResults.length - 1;
        $('#foundCount').text(objectSearchPtr + 1 + '/' + objectSearchResults.length);
        focusObject(objectSearchResults[objectSearchPtr]);
        canvas.setActiveObject(objectSearchResults[objectSearchPtr]);
    }
}

// zoom in, duh
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

// zoom out, duh
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

function epochToDateString(value){
    if (isNaN(value)) {
        return value;
    }
    else return(getDate(parseInt(value)));
}

function getDate(value) {
    var date;
    if (value !== undefined)
        date = new Date(value);
    else
        date = new Date();
    return date.getFullYear() + '-' + addZero(date.getMonth()+1) + '-' + addZero(date.getDate()) + ' ' + addZero(date.getHours()) + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds()) + '.' + date.getMilliseconds();
}

function dateStringToEpoch(value) {
    var parts = value.match(/(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})\.(\d+)/);
    var d = new Date(parts[1], parts[2]-1, parts[3], parts[4], parts[5], parts[6], parts[7]);
    return(d.getTime());
}

function startPan(event) {
    if (event.button != 2) {
        return;
    }
    var x0 = event.screenX;
    var y0 = event.screenY;
    canvas.isDragging = true;
    canvas.selection = false;
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
            canvas.requestRenderAll();
            updateMinimap();
        }
    }
    function stopPan(event) {
        canvas.isDragging = false;
        canvas.selection = true;
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
        clearInterval(socket.pingInterval);
        canvas.clear();
        canvas.requestRenderAll();
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

// set all locks on an object
function setObjectLock(o, l) {
    o.set({hasControls: !l, lockMovementX: l, lockMovementY: l, lockScalingX: l, lockScalingY: l, lockRotation: l});
}

function addObjectToCanvas(o, selected, cb) {
    if (o.type === 'link') {
        if (o.stroke_color === '') // don't allow links to disappear
            o.stroke_color = '#000000';
        var line = new fabric.Line([0,0,0,0], {
            _id: o._id,
            objType: 'link',
            image: o.image,
            name_val: o.name,
            fromId: o.obj_a,
            toId: o.obj_b,
            fill: '#000000',
            stroke: o.stroke_color,
            strokeWidth: 3,
            hasControls: false,
            selctable: true,
            locked: true,
            lockMovementX: true,
            lockMovementY: true,
            lockScalingX: true,
            lockScalingY: true,
            lockRotation: true,
        });
        var name = new fabric.Text(o.name, {
            parent_id: o._id,
            parent: line,
            objType: 'name',
            selectable: false,
            originX: 'center',
            originY: 'top',
            textAlign: 'center',
            fill: '#000000',
            angle: 0,
            fontSize: 10,
            fontFamily: 'verdana',
            left: line.getCenterPoint().x,
            top: line.getCenterPoint().y
        });
        line.children = [name];
        canvas.add(line);
        canvas.add(name);
        line.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
        updateLink(line);
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
                    _id: o._id,
                    objType: o.type,
                    image: o.image,
                    name_val: o.name,
                    originX: 'left',
                    originY: 'top',
                    left: o.x,
                    top: o.y,
                    locked: o.locked,
                    hasControls: !(!diagram_rw ? true : o.locked),
                    lockMovementX: !diagram_rw ? true : o.locked,
                    lockMovementY: !diagram_rw ? true : o.locked,
                    lockScalingX: !diagram_rw ? true : o.locked,
                    lockScalingY: !diagram_rw ? true : o.locked,
                    lockRotation: !diagram_rw ? true : o.locked
                });
                if (shape._objects && !shape.image.includes('static')) {
                    for (var i = 0; i < shape._objects.length; i++) {
                        var fill = shape._objects[i].fill;
                        var fillAlpha = 1.0;
                        try {
                            if (fill.split("(")[1].split(")")[0].split(",")[3] < 1)
                                fillAlpha = 1 - fill.split("(")[1].split(")")[0].split(",")[3];
                        } catch (e) {}
                        if (shape._objects[i].fill != '#FFFFFF' && shape._objects[i].fill !== 'rgba(255,255,255,1)' && shape._objects[i].fill !== 'rgba(254,254,254,1)' && shape._objects[i].fill !== '') {
                            var color = '#' + rgba2rgb(o.fill_color, fillAlpha);
                            shape._objects[i].set('fill', color);
                        }
                        if (o.stroke_color !== '' && shape._objects[i].stroke !== 'rgba(254,254,254,1)') {
                            shape._objects[i].set('stroke', o.stroke_color);
                        }
                    }
                }
                name = new fabric.Text(o.name, {
                    parent_id: o._id,
                    parent: shape,
                    objType: 'name',
                    selectable: false,
                    originX: 'center',
                    originY: 'top',
                    textAlign: 'center',
                    fill: '#000000',
                    fontSize: 10,
                    fontFamily: 'lato',
                    left: o.x + (shape.width * shape.scaleX)/2,
                    top: o.y + shape.height * shape.scaleY + 4
                });
                shape.children = [name];
                canvas.add(shape);
                canvas.add(name);
                if (selected === 'single')
                    canvas.setActiveObject(shape);
                else if (selected === 'group')
                    canvas.getActiveObject().addWithUpdate(shape);
                shape.moveTo(o.z*2);
                name.moveTo(o.z*2+1);
                if (cb)
                    cb();
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
                _id: o._id,
                objType: o.type,
                image: o.image,
                name_val: o.name,
                name: name,
                originX: 'left',
                originY: 'top',
                left: o.x,
                top: o.y,
                locked: o.locked,
                hasControls: !(!diagram_rw ? true : o.locked),
                lockMovementX: !diagram_rw ? true : o.locked,
                lockMovementY: !diagram_rw ? true : o.locked,
                lockScalingX: !diagram_rw ? true : o.locked,
                lockScalingY: !diagram_rw ? true : o.locked,
                lockRotation: !diagram_rw ? true : o.locked
            });
        } else if (shape === 'circle') {
            shape = new fabric.Ellipse({
                rx: o.scale_x / 2,
                ry: o.scale_y / 2,
                angle: o.rot, 
                fill: o.fill_color,
                stroke: o.stroke_color,
                strokeWidth: 2,
                _id: o._id,
                objType: o.type,
                image: o.image,
                name_val: o.name,
                name: name,
                originX: 'left',
                originY: 'top',
                left: o.x,
                top: o.y,
                locked: o.locked,
                hasControls: !(!diagram_rw ? true : o.locked),
                lockMovementX: !diagram_rw ? true : o.locked,
                lockMovementY: !diagram_rw ? true : o.locked,
                lockScalingX: !diagram_rw ? true : o.locked,
                lockScalingY: !diagram_rw ? true : o.locked,
                lockRotation: !diagram_rw ? true : o.locked
            });
        } else
            return;
        name = new fabric.Text(o.name, {
            parent_id: o._id,
            parent: shape,
            objType: 'name',
            selectable: false,
            originX: 'center',
            originY: 'top',
            textAlign: 'center',
            fill: '#000000',
            fontSize: 10,
            fontFamily: 'verdana',
            left: o.x + (shape.width * shape.scaleX)/2,
            top: o.y + shape.height * shape.scaleY + 4
        });
        shape.children = [name];
        canvas.add(shape);
        canvas.add(name);
        if (selected === 'single')
            canvas.setActiveObject(shape);
        else if (selected === 'group')
            canvas.getActiveObjects().addWithUpdate(shape);
        shape.moveTo(o.z*2);
        name.moveTo(o.z*2+1);
    }
    objectsLoaded.pop();
}
// send inesert message for inserted objects
function insertObject() {
    closeToolbar();
    if ($('#propType').val() === 'link')
        insertLink();
    else {
        var center = new fabric.Point(canvas.width / 2, canvas.height / 2);
        lastFillColor = $('#propFillColor').val();
        lastStrokeColor = $('#propStrokeColor').val();
        socket.send(JSON.stringify({act: 'insert_object', arg:{name:$('#propName').val(), fill_color:$('#propFillColor').val(), stroke_color:$('#propStrokeColor').val(), locked: $('#lockObject').is(':checked'), image:$('#prop-' + $('#propType').val()).val().replace('.png','.svg'), type:$('#propType').val(), x: Math.round(center.x / canvas.getZoom() - settings.x / canvas.getZoom()), y: Math.round(center.y / canvas.getZoom() - settings.y / canvas.getZoom()), z: canvas.getObjects().length}, msgId: msgHandler()})); 
    }
}

// send object deletions to db
function deleteObject() {
    if (canvas.getActiveObject()._id) {
        socket.send(JSON.stringify({act: 'delete_object', arg: { _id:canvas.getActiveObject()._id, type:canvas.getActiveObject().objType }, msgId: msgHandler()}));
    }
}

// send paste messages for pasted objects
function pasteObjects() {
    var center = new fabric.Point(canvas.width / 2, canvas.height / 2);
    var args = [];
    for (var i = 0; i < canvasClipboard.length; i++) {
        args.push({ _id: canvasClipboard[i]._id, x: Math.round(center.x / canvas.getZoom() - settings.x / canvas.getZoom()) + canvasClipboard[i].x, y: Math.round(center.y / canvas.getZoom() - settings.y / canvas.getZoom()) + canvasClipboard[i].y, z: canvas.getObjects().length + canvasClipboard[i].z});
    }
    socket.send(JSON.stringify({act: 'paste_object', arg: args,  msgId: msgHandler()}));
}

// send chat message to db
function sendChatMessage(msg, channel) {
    socket.send(JSON.stringify({act: 'insert_chat', arg: {channel: channel, text: msg}, msgId: msgHandler()}));
}

// move objects up / down on canvas
function moveToZ(o, z) {
    if (o) {
        if (o.objType === 'link')
            socket.send(JSON.stringify({act: 'move_object', arg: [{_id: o._id, scale_x: 0, scale_y: 0, x: 0, y: 0, z: z, rot: 0}], msgId: msgHandler()}));
        else if (o.objType === 'icon')
            socket.send(JSON.stringify({act: 'move_object', arg: [{_id: o._id, x: o.left, y: o.top, z: z, scale_x: o.scaleX, scale_y: o.scaleY, rot: o.angle}], msgId: msgHandler()}));
        else if (o.objType === 'shape')
            socket.send(JSON.stringify({act: 'move_object', arg: [{_id: o._id, x: o.left, y: o.top, z: z, scale_x: o.width, scale_y: o.height, rot: o.angle}], msgId: msgHandler()}));
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
    if (canvas.getActiveObject()._id && canvas.getObjects().indexOf(o) < canvas.getObjects().length - 2 - tempLinks.length) {
        var z = canvas.getObjects().indexOf(o) / 2 + 1;
        moveToZ(o, z);
    }
}

function moveDown() {
    var o = canvas.getActiveObject();
    if (canvas.getActiveObject()._id && canvas.getObjects().indexOf(o) > 0) {
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

function toggleObjectLock(l) {
    var o = canvas.getActiveObject();
    if (o) {
        o.locked = l;
        changeObject(o);
    }
}

function setObjectSize() {
    var o = canvas.getActiveObject();
    if (o) {
        if (o.objType === 'icon') {
            o.set('scaleX', $('#objectWidth').val() / o.width);
            o.set('scaleY', $('#objectHeight').val() / o.height);
        } else if (o.objType === 'shape') {
            o.set('width', $('#objectWidth').val());
            o.set('height', $('#objectHeight').val());
            o.resizeToScale();
            o.setCoords();
            for (var j = 0; j < o.children.length; j++) {
                if (o.children[j].objType === 'name') {
                    o.children[j].set('top', o.top + o.height * o.scaleY + 4);
                    o.children[j].set('left', o.left + (o.width * o.scaleX)/2);
                    o.children[j].setCoords();
                }
            }
        }
        changeObject(o);
    }
}
// replace an objects icon with another or change an icon's colors
function changeObject(o) {
    var tempObj = {};
    tempObj._id = o._id;
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
    tempObj.locked = o.locked;
    tempObj.name = '';
    for (var i=0; i < o.children.length; i++) {
        if (o.children[i].objType === 'name') {
            tempObj.name = o.children[i].text;
        }
    }
    socket.send(JSON.stringify({act: 'change_object', arg: tempObj, msgId: msgHandler()}));
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

//start sharedb tasks
function startTasks() {
    console.log('starting tasks');
    if (shareDBConnection.state === 'connected') {
        console.log('tasks started');
        var hostTasksDoc;
        hostTasksDoc = shareDBConnection.get('sharedb', 'm-' + mission_id + '-t-hostTasks');
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
        networkTasksDoc = shareDBConnection.get('sharedb', 'm-' + mission_id + '-t-networkTasks');
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
        ccirDoc = shareDBConnection.get('sharedb', 'm-' + mission_id + '-t-ccirs');
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
    var viewport = canvas.viewportTransform;
    canvas.setHeight(MAXHEIGHT * 2);
    canvas.setWidth(MAXWIDTH * 2);
    canvas.viewportTransform = [1, 0, 0, 1, MAXWIDTH, MAXHEIGHT];
    link.href = canvas.toDataURL('png');
    link.download = 'diagram.png';
    canvas.viewportTransform = viewport;
    resizeCanvas();
    canvas.requestRenderAll();
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

// automatically step the slider once play is pushed
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

// resize jsGrids when window or canvas resizes
function resizeTables() {
    $("#events2").setGridWidth(Math.round($('#tables').width()-5));
    $("#opnotes2").setGridWidth($('#tables').width()-5);
    $("#users").setGridWidth($('#tables').width()-5);
}

// resize fabricjs canvas when window is resized
function resizeCanvas() {
    if (canvas.getHeight() != $('#diagram').height()) {
        canvas.setHeight($('#diagram').height());
    }
    if (canvas.getWidth() != $('#diagram').width()) {
        canvas.setWidth($('#diagram').width());
    }
    updateMinimap();
}

// setup times for cop clocks
function startTime() {
    var today = new Date();
    var eh = today.getHours();
    var uh = today.getUTCHours();
    var m = today.getMinutes();
    var s = today.getSeconds();
    m = addZero(m);
    s = addZero(s);
    $('#est').html('Local: ' + eh + ":" + m + ":" + s);
    $('#utc').html('UTC: ' + uh + ":" + m + ":" + s);
    var t = setTimeout(startTime, 500);
}

function deleteObjectConfirm() {
    $('#modal-title').text('Are you sure?');
    $('#modal-body').html('<p>Are you sure you want to delete this object?</p><p>Deleting an object will delete all attached notes and unlink any events related to this object.</p>');
    $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-danger" data-dismiss="modal" onClick="cop.deleteObject();">Yes</button> <button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">No</button>');
    $('#modal-content').removeAttr('style');
    $('#modal-content').removeClass('modal-details');
    $('#modal').modal('show')
}

function deleteRowConfirm(type, table, _id, prefix) {
    $('#modal-title').text('Are you sure?');
    $('#modal-body').html('<p>Are you sure you want to delete this row?</p>');
    $('#modal-footer').html('<button type="button btn-primary" class="button btn btn-danger" data-dismiss="modal" onClick="cop.deleteRow(\'' + type + '\', \'' + table + '\', \'' + _id + '\', \'' + prefix + '\');">Yes</button> <button type="button btn-primary" class="button btn btn-default" data-dismiss="modal">No</button>');
    $('#modal-content').removeAttr('style');
    $('#modal-content').removeClass('modal-details');
    $('#modal').modal('show')
}

// handle sending jqgrid deletes and updating the grid
function deleteRow(type, table, _id, prefix) {
    socket.send(JSON.stringify({act: 'delete_' + type, arg: { _id: _id }, msgId: msgHandler()}));
    $(table).jqGrid('delRowData', prefix + _id);
}

// handle sending jqgrid saves / inserts and updating the grid
function saveRow(type, table, _id) {
    console.log(type, table, _id);
    addingRow = false;
    var data = {};
    var act = "update_" + type;
    if (_id.indexOf('jqg') !== -1) {
        $(table + ' #' + _id).find('input, select, textarea').each(function () {
            data[this.name] = $(this).val();
        });
        act = "insert_" + type;
    }
    else {
        $(table).jqGrid('saveRow', _id); 
        data = $(table).getRowData(_id);
    }
    if (data.event_time)
        data.event_time = dateStringToEpoch(data.event_time);
    if (data.discovery_time)
        data.discovery_time = dateStringToEpoch(data.discovery_time);
    $(table).jqGrid('restoreRow', _id, function(){ setTimeout(function() { socket.send(JSON.stringify({act: act, arg: data, msgId: msgHandler()}));} ,10) });
}

function getRoleSelect() {
    roleSelect.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });
    var roles = {};
    for (var i = 0; i < roleSelect.length; i++) {
        roles[roleSelect[i]._id] = roleSelect[i].name;
    }
    return roles;
}

function getUserSelect() {
    userSelect.sort(function(a, b) {
        return a.username.localeCompare(b.name);
    });
    var user = {};
    for (var i = 0; i < userSelect.length; i++) {
        user[userSelect[i]._id] = userSelect[i].username;
    }
    return user;
}

function getObjectSelect() {
    var res = ':';
    var objs = canvas.getObjects();
    objs.sort(function(a, b) {
        if (!a.name_val || !b.name_val)
            return 0;
        return a.name_val.localeCompare(b.name_val);
    });
    for (var i = 0; i < objs.length; i++) {
        if (objs[i].objType === 'icon' || objs[i].objType === 'shape')
            res += ';' + objs[i]._id + ':' + objs[i].name_val.split('\n')[0].replace(':','').replace(';','');
    }
    return res;
}

function getEventSelect() {
    var data = $('#events2').getRowData();
    var obj = {};
    obj[''] = '';
    for (var r = 0; r < data.length; r++) {
        obj[data[r]._id] = data[r]._id.substr(-5) + ' ' + data[r].event_type;
    }
    return (obj);
}

function getOpnoteSubGridData(id) {
    var tdata = new Array();
    for (var i = 0; i < $('#opnotes2').getGridParam('data').length; i++) {
        if ($('#opnotes2').getGridParam('data')[i].event_id == id)
            tdata.push($('#opnotes2').getGridParam('data')[i]);
    }
    return tdata;
}

$(document).ready(function() {
    startTime();
    notifSound = new Audio('sounds/knock.mp3');
    $('.modal-dialog').draggable({ handle: '.modal-header' });
    $('.modal-content').resizable({ minHeight: 153, minWidth: 300});
    // ---------------------------- SOCKETS ----------------------------------
    if (location.protocol === 'https:') {
        socket = new WebSocket('wss://' + window.location.host + '/mcscop/');
        wsdb = new WebSocket('wss://' + window.location.host + '/mcscop/');
    } else {
        socket = new WebSocket('ws://' + window.location.host + '/mcscop/');
        wsdb = new WebSocket('ws://' + window.location.host + '/mcscop/');
    }
    shareDBConnection = new sharedb.Connection(wsdb);
    wsdb.onopen = function() {
        wsdb.send(JSON.stringify({act: 'stream', arg: ''}));
    };

    // ---------------------------- DIAGRAM SOCKET STUFF ----------------------------------
    socket.onopen = function() {
        $('#modal').modal('hide');
        $('#modal-title').text('Please wait...!');
        $('#modal-body').html('<p>Loading COP, please wait...</p><img src="images/loading.gif"/>');
        $('#modal-footer').html('');
        $('#modal').modal('show');
        socket.pingInterval = setInterval(function ping() {
            socket.send(JSON.stringify({ act: 'ping', arg: '', msgId: msgHandler() }));
        }, 10000);
        setTimeout(function() {
            console.log('connect');
            console.log('joining mission: ' + mission_id);
            socket.send(JSON.stringify({ act:'join', arg: {mission_id: mission_id}, msgId: msgHandler() }));
        }, 100);
    };
    // message handler
    socket.onmessage = function(msg) {
        msg = JSON.parse(msg.data);
        switch(msg.act) {
            // general
            case 'ack':
                clearTimeout(pendingMsg[msg.arg]);
                delete pendingMsg[msg.arg];
                break;

            case 'error':
                $('#modal-close').hide();
                $('#modal-header').html('Error!');
                $('#modal-body').html('<p>' + msg.arg.text + '</p>');
                $('#modal-footer').html('');
                $('#modal-content').removeAttr('style');
                $('#modal-content').removeClass('modal-details');
                $('#modal').removeData('bs.modal').modal({});
                break;

            // getters
            case 'join':
                // objects
                objectsLoaded = [];
                var objects = msg.arg.objects;
                for (var o in objects) {
                    if (objects[o].type === 'icon' && SVGCache[objects[o].image] === undefined && objects[o].image !== undefined && objects[o].image !== null) {
                        SVGCache[objects[o].image] = null;
                        objectsLoaded.push(false);
                        getIcon(objects[o].image);
                    }
                }
                checkIfShapesCached(objects);

                // users
                userSelect = userSelect.concat(msg.arg.users);
                $('#events2').jqGrid('setColProp', 'assignment', { editoptions: { value: getUserSelect() }});
                $('#users').jqGrid('setColProp', 'user_id', { editoptions: { value: getUserSelect() }});

                // roles
                roleSelect = roleSelect.concat(msg.arg.roles);
                $('#users').jqGrid('setColProp', 'role', { editoptions: { value: getRoleSelect() }});

                // events
                var eventTableData = [];
                for (var e in msg.arg.events) {
                    eventTableData.push(msg.arg.events[e]);
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

                // user settings
                var userTableData = [];
                for (var user in msg.arg.userSettings) {
                    userTableData.push(msg.arg.userSettings[user]);
                }
                $('#users').jqGrid('setGridParam', {
                    datatype: 'local',
                    data: userTableData
                }).trigger("reloadGrid");

                // opnotes
                var opnoteTableData = [];
                for (var e in msg.arg.opnotes) {
                    opnoteTableData.push(msg.arg.opnotes[e]);
                }
                $('#opnotes2').jqGrid('setGridParam', { 
                    datatype: 'local',
                    data: opnoteTableData
                }).trigger("reloadGrid");
                $('#opnotes2').jqGrid('setColProp', 'event_id', { editoptions: { value: getEventSelect() }});
                $('#opnotes2').jqGrid().trigger('reloadGrid');


                // notes
                createNotesTree(msg.arg.notes);

                // chat
                addChatMessage(msg.arg.chats, true);

                break;

            // chat
            case 'bulk_chat':
                addChatMessage(msg.arg, true);
                break;
            case 'chat':
                addChatMessage(msg.arg);
                break;

            // files
            case 'update_files':
                $('#files').jstree('refresh');
                break;

            // notes
            case 'insert_note':
                $('#notes').jstree(true).create_node('#', msg.arg);
                break;
            case 'rename_note':
                var node = $('#notes').jstree(true).get_node(msg.arg.id, true);
                if (node)
                    $('#notes').jstree(true).rename_node(node, msg.arg.name);
                break;
            case 'delete_note':
                var node = $('#notes').jstree(true).get_node(msg.arg.id, true);
                if (node)
                    $('#notes').jstree(true).delete_node(node);
                break;

            // events
            case 'update_event':
                var e = msg.arg;
                console.log(e);
                $('#events2').jqGrid('setRowData', e._id, e);
                break;

            case 'insert_event':
                var e = msg.arg;
                $('#events2').jqGrid('addRowData', e._id, e, 'last');
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
                // new event, update event_id chooser on opnotes table
                $('#opnotes2').jqGrid('setColProp', 'event_id', { editoptions: { value: getObjectSelect() }});
                $('#opnotes2').jqGrid().trigger('reloadGrid');

                break;

            case 'delete_event':
                var e = msg.arg;
                $('#events2').jqGrid('delRowData', e._id);
                dateSlider.noUiSlider.updateOptions({
                    start: [-1, $('#events2').getRowData().length],
                    behaviour: 'drag',
                    range: {
                        'min': -1,
                        'max': $('#events2').getRowData().length
                    },
                    step: 1
                });
                // new event, update event_id chooser on opnotes table
                $('#opnotes2').jqGrid('setColProp', 'event_id', { editoptions: { value: getObjectSelect() }});
                $('#opnotes2').jqGrid().trigger('reloadGrid');
                break;

            // opnotes
            case 'update_opnote':
                var e = msg.arg;
                $('#opnotes2').jqGrid('setRowData', e._id, e);
                break;

            case 'insert_opnote':
                var e = msg.arg;
                $('#opnotes2').jqGrid('addRowData', e._id, e, 'last');
                $('#opnotes2').jqGrid('sortGrid', 'event_time', false, 'asc');
                break;

            case 'delete_opnote':
                var e = msg.arg;
                $('#opnotes2').jqGrid('delRowData', e._id);
                break;

            // users
            case 'update_user_setting':
                var e = msg.arg;
                $('#users').jqGrid('setRowData', e._id, e);
                break;

            case 'insert_user_setting':
                var e = msg.arg;
                $('#users').jqGrid('addRowData', e._id, e, 'last');
                $('#users').jqGrid('sortGrid', 'event_time', false, 'asc');
                break;

            case 'delete_user_setting':
                var e = msg.arg;
                $('#users').jqGrid('delRowData', e._id);
                break;

            // objects
            case 'change_object':
                var o = msg.arg;
                var selected = '';
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i)._id === o._id) {
                        var to = canvas.item(i);
                        if (to === canvas.getActiveObject()) {
                            updatingObject = true;
                            selected = 'single';
                            if (canvas.getActiveObjects().length > 1) {
                                selected = 'group';
                                canvas.getActiveObjects().remove(to);
                            }
                        }
                        if (o.type === 'icon') {
                            var old_children = [];
                            for (var k = 0; k < to.children.length; k++) {
                                if (to.children[k].objType ===  'link')
                                    old_children.push(to.children[k]);
                                if (to.children[k].objType === 'name')
                                    canvas.remove(to.children[k]);
                            }
                            canvas.remove(to);
                            cb = function() {
                                for (k = 0; k < old_children.length; k++) {
                                    updateLink(old_children[k]);
                                }
                                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                                $('#events2').jqGrid().trigger('reloadGrid');
                            }
                            addObjectToCanvas(o, selected, cb);
                            canvas.requestRenderAll();
                        } else if (o.type === 'shape' || o.type === 'link') {
                            setObjectLock(canvas.item(i), o.locked);
                            if (o.type === 'link' && o.stroke_color === '') // don't let links disappear
                                o.stroke_color = '#000000';
                            if (canvas.item(i).name_val !== o.name) {
                                console.log('renaming');
                                canvas.item(i).name_val = o.name;
                                for (var k = 0; k < to.children.length; k++) {
                                    if (canvas.item(i).children[k].objType === 'name') {
                                        canvas.item(i).children[k].set('text', o.name);
                                    }
                                }
                                // if not link, update object selections
                                if (o.type !== 'link') {
                                    $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                                    $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                                    $('#events2').jqGrid().trigger('reloadGrid');
                                }
                            }
                            canvas.item(i).set('stroke', o.stroke_color);
                            canvas.item(i).set('fill', o.fill_color);
                            canvas.item(i).set('dirty', true);
                            canvas.requestRenderAll();
                        }
                        updatingObject = false;
                        break;
                    }
                }
                break;

           case 'move_object':
                for (var h = 0; h < msg.arg.length; h++) {
                    var o = msg.arg[h];
                    for (var i = 0; i < canvas.getObjects().length; i++) {
                        if (canvas.item(i)._id == o._id) {
                            var obj = canvas.item(i);
                            obj.dirty = true;
                            console.log(obj.objType);
                            if (obj.objType !== 'link') {
                                obj.set('angle', o.rot);
                                if (o.type === 'shape') {
                                    obj.set('width', o.scale_x);
                                    obj.set('height', o.scale_y);
                                } else if (o.type === 'icon') {
                                    obj.set('scaleX', o.scale_x);
                                    obj.set('scaleY', o.scale_y);
                                }
                                var tmod = 0;
                                var lmod = 0;
                                if (canvas.getActiveObjects().length > 1 && canvas.getActiveObjects().indexOf(obj) > -1) {
                                    canvas.getActiveObject().removeWithUpdate(obj);
                                }
                                obj.set({left: o.x, top: o.y});
                                for (var j = 0; j < obj.children.length; j++) {
                                    if (obj.children[j].objType === 'name') {
                                        obj.children[j].set('top', tmod + obj.top + obj.height * obj.scaleY + 4);
                                        obj.children[j].set('left', lmod + obj.left + (obj.width * obj.scaleX)/2);
                                        obj.children[j].setCoords();
                                    } else if (obj.children[j].objType === 'link') {
                                        drawLink(obj.children[j]);
                                    }
                                }
                                obj.setCoords();
                            }
                            if (o.z !== undefined && i !== o.z*2) {
                                if (i < o.z*2) {
                                    obj.moveTo((o.z)*2 + 1);
                                    for (var k = 0; k < obj.children.length; k++) {
                                        if (obj.children[k].objType === 'name') {
                                            obj.children[k].moveTo(canvas.getObjects().indexOf(obj));
                                        }
                                    }
                                } else {
                                    obj.moveTo(o.z*2);
                                    for (var k = 0; k < obj.children.length; k++) {
                                        if (obj.children[k].objType === 'name') {
                                            obj.children[k].moveTo(canvas.getObjects().indexOf(obj)+1);
                                        }
                                    }
                                }
                            }
                            break;
                        }
                    }
                }
                canvas.requestRenderAll();
                updateMinimapBg();
                break;

            case 'insert_object':
                for (var h = 0; h < msg.arg.length; h++) {
                    var o = msg.arg[h];
                    addObjectToCanvas(o, false);
                }
                $('#events2').jqGrid('setColProp', 'dest_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid('setColProp', 'source_object', { editoptions: { value: getObjectSelect() }});
                $('#events2').jqGrid().trigger('reloadGrid');
                updateMinimapBg();
                break;

            case 'delete_object':
                var _id = msg.arg;
                for (var i = 0; i < canvas.getObjects().length; i++) {
                    if (canvas.item(i)._id == _id) {
                        var object = canvas.item(i);
                        if (canvas.item(i).children !== undefined) {
                            for (var k = 0; k < object.children.length; k++) {
                                if (object.children[k].objType === 'name')
                                    canvas.remove(object.children[k]);
                            }
                        }
                        if (canvas.getActiveObjects().indexOf(object) > 1)
                            canvas.getActiveObject().removeWithUpdate(object);
                        canvas.remove(object);
                        break;
                    }
                }
                updateMinimapBg();
                canvas.requestRenderAll();
                break;
        }
    };

    socket.onclose = function() {
        canvas.clear();
        canvas.requestRenderAll();
        clearInterval(socket.pingInterval);
        $('#modal-close').hide();
        $('#modal-title').text('Attention!');
        $('#modal-body').html('<p>Connection lost! Please refesh the page to retry!</p>');
        $('#modal-footer').html('');
        $('#modal-content').removeAttr('style');
        $('#modal-content').removeClass('modal-details');
        $('#modal').removeData('bs.modal').modal({backdrop: 'static', keyboard: false});
    };

    // start the three task windows
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
                            $('#message').html('<span class="messageHeader">' + getDate(rows[i].event_time) + '</span><br/><span class="messageBody">' + rows[i].short_desc.replace('\n','<br>') + '</span>');
                        $($('#events2').jqGrid('getInd', rows[i]._id, true)).addClass('highlight');
                        var from = null;
                        var to = null;
                        var tempLink;
                        for (var j = 0; j < canvas.getObjects().length; j++) {
                            if (canvas.item(j)._id == rows[i].source_object || canvas.item(j)._id == rows[i].dest_object) {
                                if (canvas.item(j)._id == rows[i].source_object) {
                                    from = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: from,
                                        objType: 'shape',
                                        width: from.width * from.scaleX + 10,
                                        height: from.height * from.scaleY + 10,
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
                                } else if (canvas.item(j)._id == rows[i].dest_object) {
                                    to = canvas.item(j);
                                    var shape = new fabric.Rect({
                                        dad: to,
                                        objType: 'shape',
                                        width: to.width * to.scaleX + 10,
                                        height: to.height * to.scaleY + 10,
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
                                var line = new fabric.Line([getObjCtr(from).x, getObjCtr(from).y, getObjCtr(to).x, getObjCtr(to).y], {
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
                        $($('#events2').jqGrid('getInd', rows[i]._id, true)).removeClass('highlight');
                    }
                }
            }
            canvas.requestRenderAll();
        }
    });
    // ---------------------------- JQGRIDS ----------------------------------
    $(window).click(function(e) {
        lastClick = e.target;
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
            { label: 'Id', name: '_id', hidden: true, width: 0, fixed: 0, key: true, editable: false, hidden: true },
            { label: ' ', template: 'actions', fixed: true, formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!opnotes_del)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="cop.deleteRowConfirm(\'opnote\', \'#opnotes2\', \'' + options.rowId + '\', \'opnotes_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> ';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-row ui-inline-save-row" id="jSaveButton_' + options.rowId + '" onclick="cop.saveRow(\'opnote\', \'#opnotes2\', \'' + options.rowId + '\', \'opnotes_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-cell ui-inline-save-cell" id="jSaveButton_' + options.rowId + '" onclick="$(\'#opnotes2\').saveCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-row" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\'); addingRow = false;" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    buttons +=  '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-cell" id="jCancelButton_' + options.rowId + '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="btn_cancel_' + options.rowId + '" onclick="$(\'#opnotes2\').restoreCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    buttons += '<div title="Details" style="float: left;" class="ui-pg-div ui-inline-cell ui-inline-edit-details" id="details_opnotes_' + options.rowId + '" onclick="cop.editDetails(\'opnotes-' + options.rowId + '\', \'Opnote - ' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-note"></span></div>';
                    return buttons;
                },
                width: 45,
                hidden: !opnotes_rw,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Id', name: 'event_id', width: 100, fixed: true, editable: opnotes_rw,  formatter: 'select', edittype: 'select', editoptions: { value: '' } },
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
            { label: 'Host/Device', name: 'source_object', width: 150, fixed: true, editable: opnotes_rw },
            { label: 'Tool', name: 'tool', width: 150, fixed: true, editable: opnotes_rw },
            { label: 'Action', name: 'action', width: 200, fixed: false, edittype: 'textarea', editable: opnotes_rw, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                return 'style="white-space: pre-wrap;"';
            }},
            { label: 'Operator', name: 'username', width: 100, fixed: true, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        // called when directly clicking on an existing cell to edit
        beforeEditCell: function (id, cn, val, iRow, iCol) {
            if (cn === 'event_id')
                $('#opnotes2').jqGrid('setColProp', 'event_id', { editoptions: { value: getEventSelect() }});
            if (lastselection.id && lastselection.id !== id) {
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-cell').hide();
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-cell').hide();
                $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-edit-details').show();
            }
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-cell').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-cell').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-edit-details').hide();
            lastselection = {id: id, iRow: iRow, iCol: iCol};
        },
        beforeSaveCell: function(options, col, value) {
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-edit-details').show();
            $('#opnotes2').jqGrid('resetSelection');
            lastselection.id = null;
            var data = $('#opnotes2').getRowData(options);
            data[col] = value;
            if (data.event_time)
                data.event_time = dateStringToEpoch(data.event_time);
            delete data.actions;
            delete data.undefined;
            socket.send(JSON.stringify({act: 'update_opnote', arg: data, msgId: msgHandler()}));
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
            $('#opnotes2 tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-edit-details').show();
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
                    $('#opnotes2').jqGrid('setColProp', 'event_id', { editoptions: { value: getEventSelect() }});
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
                                socket.send(JSON.stringify({act: 'insert_opnote', arg: data, msgId: msgHandler()}));
                                $('#opnotes2').jqGrid('resetSelection');
                            },
                            // called when creating a new row
                            oneditfunc: function(id, cn, val, iRow, iCol) {
                                // get most recent events for event dropdown
                                if (lastselection.id && lastselection.id !== id) {
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-row').hide();
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-row').hide();
                                    $('#opnotes2 tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-edit-details').show();
                                }
                                $('#details_'+$.jgrid.jqID(id)).hide();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-row').show();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-row').show();
                                $('#opnotes2 tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-edit-details').hide();
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
    // opnotes search
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
                    { label: 'Opnote Id', name: '_id', width: 40, hidden: true, fixed: true, key: true, editable: false },
                    { label: 'Event Time', name: 'event_time', width: 180, fixed: true, editable: false, formatter: epochToDateString },
                    { label: 'Host/Device', name: 'source_object', editable: false },
                    { label: 'Tool', name: 'tool', editable: false },
                    { label: 'Action', name: 'action', width: 250, editable: false, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                        return 'style="white-space: pre-wrap;"';
                    }},
                    { label: 'Operator', name: 'username', width: 100, fixed: true, editable: false },
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
            { label: 'Id', name: '_id', width: 40, fixed: true, key: true, editable: false, hidden: true },
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
            { label: 'Source', name: 'source_object', width: 80, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: { value: '' }},
            { label: 'SPort', name: 'source_port', width: 60, editable: events_rw },
            { label: 'Destination', name: 'dest_object', width: 80, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: { value: '' }},
            { label: 'DPort', name: 'dest_port', width: 60, editable: events_rw },
            { label: 'Event Type', name: 'event_type', width: 150, editable: events_rw },
            { label: 'Event Description', name: 'short_desc', width: 200, edittype: 'textarea', editable: events_rw, cellattr: function (rowId, tv, rawObject, cm, rdata) {
                return 'style="white-space: pre-wrap;"';
            }},
            { label: 'Assignment', name: 'assignment', width: 100, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: { value: '' } },
            { label: 'Operator', name: 'username', width: 100, editable: false },
        ],
        onSelectRow: function() {
            return false;
        },
        beforeSelectRow: function(rowid, e) {
            return false;
        },
        beforeEditCell: function (id, cn, val, iRow, iCol) {
            // get / set users dropdown
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
            socket.send(JSON.stringify({act: 'update_event', arg: data, msgId: msgHandler()}));
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
                    // get / set user select
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
                                $('#events2').jqGrid('restoreRow', id, function(){ setTimeout(function () { socket.send(JSON.stringify({act: 'insert_event', arg: data, msgId: msgHandler()})); } , 10); });
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
    // events search
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
        datatype: 'local',
        cellsubmit: 'clientArray',
        editurl: 'clientArray',
        data: [],
        gridview: true,
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
            { label: 'Id', name: '_id', width: 40, fixed: true, key: true, editable: false, hidden: true },
            { label: ' ', name: 'actions', fixed: true, formatter: function(cell, options, row) {
                    var buttons = '<div title="Delete row" style="float: left;';
                    if (!users_rw)
                        buttons += ' display: none;';
                    buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="cop.deleteRowConfirm(\'user_setting\', \'#users\', \'' + options.rowId + '\', \'users_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> ';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save ui-inline-save-row" id="jSaveButton_' + options.rowId + '" onclick="cop.saveRow(\'user_setting\', \'#users\', \'' + options.rowId + '\', \'users_\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save ui-inline-save-cell" id="jSaveButton_' + options.rowId + '" onclick="$(\'#users\').saveCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div>';
                    buttons += '<div title="Cancel new row" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-row" id="jCancelButton_' + options.rowId + '" onclick="jQuery.fn.fmatter.rowactions.call(this,\'cancel\'); addingRow = false;" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    buttons +=  '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel ui-inline-cancel-cell" id="jCancelButton_' + options.rowId + '<div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="btn_cancel_' + options.rowId + '" onclick="$(\'#users\').restoreCell(lastselection.iRow, lastselection.iCol);" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                    return buttons;
                },
                width: 50,
                hidden: !users_rw,
                formatoptions: {
                    keys: true,
                }
            },
            { label: 'Username', name: 'user_id', width: 100, editable: events_rw, formatter: 'select', edittype: 'select', editoptions: { value: '' } },
            { label: 'Role (Optional)', name: 'role', width: 100, editable: users_rw, formatter: 'select', edittype: 'select', editoptions: { value: '' } },
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
            if (lastselection.id && lastselection.id !== id) {
                $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-cell').hide();
                $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-cell').hide();
            }
            $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
            $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-cell').show();
            $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-cell').show();
            lastselection = {id: id, iRow: iRow, iCol: iCol};
        },
        beforeSaveCell: function (options, col, value) {
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#users').jqGrid('resetSelection');
            lastselection.id = null;
            var data = $('#users').getRowData(options);
            data[col] = value;
            delete data.actions;
            if (!Array.isArray(data.permissions))
                data.permissions = data.permissions.split(',');
            socket.send(JSON.stringify({act: 'update_user_setting', arg: data, msgId: msgHandler()}));
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
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-del').show();
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-save-cell').hide();
            $('#users tr#'+$.jgrid.jqID(options)+ ' div.ui-inline-cancel-cell').hide();
            $('#users').jqGrid('resetSelection');
        }
    });
    //users pager
    $('#users').jqGrid('navGrid', '#usersPager', {
        add: false,
        edit: false,
        del: false,
        refresh: false
    });
    if (users_rw) {
        $('#users').jqGrid('navGrid').jqGrid('navButtonAdd', '#usersPager', {
            position:"last",
            caption:"",
            buttonicon:"ui-icon-plus",
            onClickButton: function(){
                if (cellEdit)
                    cellEdit();
                if (!addingRow) {
                    addingRow = true;
                    // get / set roles and users dropdown
                    $('#users').jqGrid('addRow', {position: 'last', addRowParams: {
                            keys: true,
                            beforeSaveRow: function(options, id) {
                                addingRow = false;
                                data = {};
                                $(this).find('input, select, textarea').each(function () {
                                    data[this.name] = $(this).val();
                                });
                                delete data.actions;
                                $('#users').jqGrid('restoreRow', id, function(){ setTimeout(function () { socket.send(JSON.stringify({act: 'insert_user', arg: data, msgId: msgHandler()})); } , 10); });
                                $('#users').jqGrid('resetSelection');
                            },
                            oneditfunc: function(id) {
                                if (lastselection.id && lastselection.id !== id) {
                                    $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-del').show();
                                    $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-save-row').hide();
                                    $('#users tr#'+$.jgrid.jqID(lastselection.id)+ ' div.ui-inline-cancel-row').hide();
                                }
                                $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-del').hide();
                                $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-save-row').show();
                                $('#users tr#'+$.jgrid.jqID(id)+ ' div.ui-inline-cancel-row').show();
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
        $('#chatTab').css('background-color', '');
        if (!chatPosition[c] || chatPosition[c] === 'bottom')
            $('#' + c).scrollTop($('#' + c)[0].scrollHeight);
        $('#channel-' + c).addClass('channel-selected');
        activeChannel = c;
    });

    $('#chatTab').click(function(e) {
        unreadMessages[activeChannel] = 0;
        $('#unread-' + activeChannel).hide();
        $('#chatTab').css('background-color', '');
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
        clear_btn: null,
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
    
    // make the diagram resizable
    $("#diagram_jumbotron").resizable({ handles: 's', minHeight: 100 });
    $("#toolbar-body").resizable({ handles: 'w', maxWidth: $('#diagram_jumbotron').width()-60 });

    // resize event to resize canvas and toolbars
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

    // on reseize, resize the canvas and our jqgrids
    window.addEventListener('resize', function() {
        resizeTables();
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            resizeCanvas();
        }, 100);
    }, false);
    
    // capture enter key in chat input bar
    $("#message-input-box").keypress(function (e) {
        var key = e.charCode || e.keyCode || 0;
        if (key === $.ui.keyCode.ENTER) {
            sendChatMessage($("#message-input-box").val(), activeChannel);
            $("#message-input-box").val('');
        }
    });

    // capture keys
    window.addEventListener("keydown",function (e) {
        // copy
        if (lastClick === canvas.upperCanvasEl) {
            if (e.ctrlKey && (e.keyCode === 'c'.charCodeAt(0) || e.keyCode === 'C'.charCodeAt(0))) {
                canvasClipboard = [];
                o = canvas.getActiveObjects();

                var x = 0;
                var y = 0;
                           
                for (var i = 0; i < o.length; i++) {
                    if (o.length === 1) {
                        x = 0 - o[i].width/2;
                        y = 0 - o[i].height/2;
                    } else {
                        x = o[i].left;
                        y = o[i].top;
                    }
                    canvasClipboard.push({ _id: o[i]._id, x: x, y: y, z: Math.round(canvas.getObjects().indexOf(o[i] / 2)) });
                }
            
            // paste
            } else if (e.ctrlKey && (e.keyCode === 'v'.charCodeAt(0) || e.keyCode === 'V'.charCodeAt(0))) {
                if (canvasClipboard.length > 0)
                    pasteObjects();

            // delete
            } else if (e.keyCode === 46) {
                if (canvas.getActiveObject())
                   deleteObjectConfirm();

            // left arrow
            } else if (e.keyCode >= 37 && e.keyCode <= 40 && canvas.getActiveObject()) {
                var o = canvas.getActiveObject();
                if (objectMovingTimer)
                    window.clearTimeout(objectMovingTimer);
                objectMovingTimer = setTimeout(function() {
                    objectModified(o);
                }, 1000);
                switch (e.keyCode) {
                    case 37:
                        o.left -= 1;
                        break;
                    case 38:
                        o.top -= 1;
                        break;
                    case 39:
                        o.left += 1;
                        break;
                    case 40:
                        o.top += 1;
                        break;
                }
                objectMoving(o, 0);
                o.setCoords();
                canvas.requestRenderAll();

            // search (ctrl + f)
            } else if (e.keyCode === 114 || (e.ctrlKey && e.keyCode === 70)) { 
                e.preventDefault();
                if (!$('#objectSearchBar').is(':visible')) {
                    $('#objectSearchBar').show().css('display', 'table');
                    $('#objectSearch').focus();
                } else {
                    $('#foundCount').hide();
                    $('#objectSearchBar').hide();
                    $('#objectSearch').val('');
                }
            }
        }
    })
    $('#diagram_jumbotron').focus();
    // load settings from cookie
    loadSettings();
    resizeTables();
    resizeCanvas();
});

// publically accessible functions
module.exports = {
    getMoreMessages: getMoreMessages,
    deleteObject: deleteObject,
    saveRow: saveRow,
    deleteRow: deleteRow,
    deleteRowConfirm: deleteRowConfirm,
    editDetails: editDetails,
    canvas: canvas
};
