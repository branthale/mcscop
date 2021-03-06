global.jQuery = require('jquery');
global.$ = jQuery;
require('./jquery-ui.min.js');
require('bootstrap');
var jqGrid = require('./jquery.jqGrid.min');
require('./grid.locale-en');

var lastSelection;

if (!permissions)
    permissions = [];

function showModal(title, body, footer) {
    $('#modal-title').text(title);
    $('#modal-body').html('<p>' + body + '</p>');
    $('#modal-footer').html(footer);
    $('#modal').modal('show')
}

$("#changePassword").click(function(e) { e.preventDefault(); changePassword(); });
function changePassword() {
    if ($('#cpNew').val() !== $('#cpConfirm').val()) {
        $('#modal-title').text('Error!');
        $('#modal-body').html('<p>Passwords do not match, please try again.</p>');
        $('#modal-footer').html('');
        $('#modal').modal('show')
    } else {
        var data = {newpass: $('#cpNew').val()};
        $('#cpNew').val('');
        $('#cpConfirm').val('');
        $.ajax({
            url: 'api/change_password',
            type: 'POST',
            data: data,
            dataType: 'json',
            cache: false,
            success: function(resp) {
                if (resp == 'OK') {
                    $('#modal-title').text('Password Changed!');
                    $('#modal-body').html('<p>Password changed successfully!</p>');
                } else {
                    $('#modal-title').text('Error!');
                    $('#modal-body').html('<p>Error changing password, check values and try again.</p>');
                }
                $('#modal-footer').html('');
                $('#modal').modal('show')
            },
            error: function() {
                console.log('mission delete error');
            }
        });
    }
}

var _URL = window.URL || window.webkitURL;
var f = function(e)
{
    var srcElement = e.srcElement? e.srcElement : e.target;
    if ($.inArray('Files', e.dataTransfer.types) > -1)
    {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = ($(srcElement).hasClass('droppable')) ? 'copy' : 'none';
        if (e.type == 'drop') {
            if (e.dataTransfer.files.length > 1) {
                $('#modal-title').text('Upload Error!');
                $('#modal-body').html('<p>Sorry, only one file at a time!</p>');
                $('#modal-footer').html('');
                $('#modal').modal('show')
                return;
            }
            var formData = new FormData();
            var file = e.dataTransfer.files[0];
            formData.append('file',file);
            formData.append('id',e.target.id.split('_')[1]);
            var img = new Image();
            img.onload = function() {
                if (this.width > 72 || this.height > 72 || this.height !== this.width || file['type'] !== 'image/png') {
                    showModal('Image Error!', 'Sorry, avatars must be <= 72x72px, square, and in .png format.', '');
                } else {
                    $.ajax({
                        url: 'avatar',
                        type: 'POST',
                        data: formData,
                        dataType: 'json',
                        cache: false,
                        contentType: false,
                        processData: false,
                        success: function() {
                            e.target.src = 'images/avatars/' + e.target.id.split('_')[1] + '.png?' + new Date().getTime();
//                            $("#users").trigger("reloadGrid");
                        },
                        error: function() {
                            console.log('upload error');
                        }
                    });
                }
            };
            img.onerror = function() {
                showModal('Image Error!', 'Sorry, avatars must be <= 72x72px, square, and in .png format.', '');
            };
            img.src = _URL.createObjectURL(file);
        }
    }
};

function deleteRow(e, type, table, id) {
    e.stopPropagation();
    $.ajax({
        url: 'api/' + type,
        type: 'POST',
        data: {id: id, table: table, oper: 'del'},
        dataType: 'json',
        cache: false,
        success: function(data) {
            $(table).jqGrid('delRowData', id);
        },
        error: function() {
        }
    });
}

function saveRow(e, type, table, id) {
    e.stopPropagation();
    lastSelection = null;
    var data = {};
    var oper = 'edit';
    if (id.indexOf('jqg') !== -1)
        oper = 'add';
    $(table).jqGrid('saveRow', id, {extraparam: {oper: oper}});
    $(table).trigger("reloadGrid");           
}

function cancelRow(e, type, table, id) {
    e.stopPropagation();
    lastSelection = null;
    e.stopPropagation();
    $(table).jqGrid('restoreRow', id);
    $(table).jqGrid('resetSelection');
}


$(document).ready(function() {
    document.body.addEventListener('dragleave', f, false);
    document.body.addEventListener('dragover', f, false);
    document.body.addEventListener('drop', f, false);
    var roles_rw = false;
    if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_roles') !== -1) {
        roles_rw = true;
        $('#rolesJumbotron').show();
    } 
    if (roles_rw) {
        $("#roles").jqGrid({
            datatype: 'json',
            mtype: 'POST',
            url: 'api/roles',
            editurl: 'api/roles',
            autowidth: true,
            regional: 'en',
            height: 300,
            reloadAfterSubmit: true,
            colModel: [
                { label: ' ', template: 'actions', formatter: function(cell, options, row) {
                        var buttons = '<div title="Delete row" style="float: left;';
                        if (!users_rw)
                            buttons += ' display: none;';
                        buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="config.deleteRow(event, \'roles\', \'#roles\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> <div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save" id="jSaveButton_' + options.rowId + '" onclick="config.saveRow(event, \'roles\', \'#roles\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div><div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="jCancelButton_' + options.rowId + '" onclick="config.cancelRow(event, \'roles\', \'#roles\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                        return buttons;
                    },
                    width: 15,
                    formatoptions: {
                        keys: true,
                    }
                },
                { label: 'Role Id', name: 'id', key: true, editable: false, hidden: true},
                { label: 'Name', name: 'name', width: 50, editable: roles_rw, edittype: 'text' },
                { label: 'Sub-Roles', name: 'sub_roles', width: 150, editable: roles_rw, edittype: 'select', editoptions: {
                        dataUrl: 'getroles',
                        multiple: true,
                        size: 10
                    }
                },

            ],
            pager: '#rolesPager',
            pgbuttons: false,
            pgtext: null,
            onSelectRow: function (id) {
                if (id && id !== lastSelection && roles_rw) {
                    var grid = $("#roles");
                    grid.jqGrid('restoreRow', lastSelection);
                    $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                    $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-edit").hide();
                    $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                    $("table#roles tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                    lastSelection = id;
                    grid.jqGrid('editRow', id, {keys: true, successfunc: function () {
                            $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-del").show();
                            $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-edit").show();
                            $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-save").hide();
                            $("table#roles tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-cancel").hide();
                            $("#roles").trigger("reloadGrid");
                            lastSelection = null;
                        },
                        afterrestorefunc: function (options) {
                            lastSelection = null;
                            $('#roles').jqGrid('resetSelection');
                        }
                    });
                }
            }
        });
        $('#roles').jqGrid('navGrid', '#rolesPager', {
            add: false,
            edit: false,
            del: false,
        });
        $('#roles').jqGrid('inlineNav','#rolesPager', {
            edit: false,
            add: roles_rw,
            del: false,
            save: false,
            cancel: false,
            addParams: {
                addRowParams: {
                    keys: true,
                    successfunc: function() {
                        $("#roles").trigger("reloadGrid");
                    },
                    url: 'api/roles'
                },
            }
        });
        $(window).bind("resize", function () {
            $("#roles").jqGrid("setGridWidth", $("#roles").closest(".jumbotron").width());
        }).triggerHandler("resize")
    }

    var users_rw = false;
    if (permissions.indexOf('all') !== -1 || permissions.indexOf('manage_users') !== -1) {
        users_rw = true;
        $('#usersJumbotron').show();
    }

    if (users_rw) {
        $("#users").jqGrid({
            datatype: 'json',
            mtype: 'POST',
            url: 'api/users',
            editurl: 'api/users',
            autowidth: true,
            maxHeight: 600,
            height: 300,
            reloadAfterSubmit: true,
            colModel: [
                { label: ' ', template: 'actions', formatter: function(cell, options, row) {
                        var buttons = '<div title="Delete row" style="float: left;';
                        if (!users_rw)
                            buttons += ' display: none;';
                        buttons += '" class="ui-pg-div ui-inline-del" id="jDelButton_' + options.rowId + '" onclick="config.deleteRow(event, \'users\', \'#users\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-trash"></span></div> <div title="Save row" style="float: left; display: none;" class="ui-pg-div ui-inline-save" id="jSaveButton_' + options.rowId + '" onclick="config.saveRow(event, \'users\', \'#users\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-disk"></span></div><div title="Cancel row editing" style="float: left; display: none;" class="ui-pg-div ui-inline-cancel" id="jCancelButton_' + options.rowId + '" onclick="config.cancelRow(event, \'users\', \'#users\', \'' + options.rowId + '\')" onmouseover="jQuery(this).addClass(\'ui-state-hover\');" onmouseout="jQuery(this).removeClass(\'ui-state-hover\');"><span class="ui-icon ui-icon-cancel"></span></div>';
                        return buttons;
                    },
                    width: 15,
                    formatoptions: {
                        keys: true,
                    }
                },
                { label: 'id', name: 'id', key: true, editable: false, hidden: true },
                { label: 'Avatar', name: 'avatar', width: 53, fixed: true, editable: false, formatter: function (c, o, r) {
                        if (r.avatar !== null)
                            return '<img class="droppable avatar" id="avatar_' + r.id + '" src="images/avatars/' + r.id + '.png"/>';
                        else
                            return '<img class="droppable avatar" id="avatar_' + r.id + '" src="images/avatars/blank.png"/>';
                    }
                },
                { label: 'Username', name: 'username', width: 50, editable: users_rw, edittype: 'text' },
                { label: 'Name', name: 'name', width: 50, editable: users_rw, edittype: 'text' },
                { label: 'Set Password', name: 'password', width: 50, editable: users_rw, edittype: 'password' },
                { label: 'System Permissions', name: 'permissions', width: 200, editable: users_rw, edittype: 'select', formatter: 'select', editoptions: {
                        value: {none: 'None', all:'All', manage_missions:'Manage Missions', delete_missions: 'Delete Missions', manage_users:'Manage Users', manage_roles:'Manage Roles'},
                        multiple: true,
                        size: 10
                    }
                }

            ],
            sortable: true,
            pager: '#usersPager',
            pgbuttons: false,
            pgtext: null,
            onSelectRow: function (id, r, e) {
                if (id && id !== lastSelection && users_rw) {
                    var grid = $("#users");
                    grid.jqGrid('restoreRow', lastSelection);
                    $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-del").hide();
                    $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-edit").hide();
                    $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-save").show();
                    $("table#users tr#"+$.jgrid.jqID(id)+ " div.ui-inline-cancel").show();
                    lastSelection = id;
                    grid.jqGrid('editRow', id, {keys: true, successfunc: function () {
                            $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-del").show();
                            $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-edit").show();
                            $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-save").hide();
                            $("table#users tr#"+$.jgrid.jqID(lastSelection)+ " div.ui-inline-cancel").hide();
                            $("#users").trigger("reloadGrid");
                            lastSelection = null;
                        },
                        afterrestorefunc: function (options) {
                            lastSelection = null;
                            $('#users').jqGrid('resetSelection');
                        }
                    });
                }
            },
        });
        $('#users').navGrid('#usersPager', {
            add: false,
            edit: false,
            del: false
        });
        $('#users').inlineNav('#usersPager', {
            edit: false,
            add: users_rw,
            del: false,
            cancel: false,
            save: false,
            addParams: {
                addRowParams: {
                    keys: true,
                    successfunc: function() {
                        $("#users").trigger("reloadGrid");
                    },
                    url: 'api/users'
                },
            }
        });
        $(window).bind("resize", function () {
            $("#users").jqGrid("setGridWidth", $("#users").closest(".jumbotron").width());
        }).triggerHandler("resize");
    }
});

module.exports = {
    saveRow: saveRow,
    cancelRow: cancelRow,
    deleteRow: deleteRow
};
