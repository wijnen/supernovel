"use strict";

// Globals. {{{

var server;	// Handle for server communication.
var group, chapter, access, script, question, sprite, image, audio;	// Results of list_*()
var edit = {};	// Current contents of script editing window.
// }}}

// Server communication. {{{
var Connection = { // {{{
	userdata_setup: userdata_setup,
}; // }}}

function init() { // {{{
	// Initialize everything.
	// Returns undefined.

	server = Rpc(Connection, null, null);
} // }}}
window.AddEvent('load', init);

function connected() { // {{{
	server.call('list_groups', [], {}, function(g) {
		group = g;
		server.call('list_chapters', [], {}, function(c) {
			chapter = c;
			server.call('list_access', [], {}, function(a) {
				access = a;
				server.call('list_scripts', [], {}, function(s) {
					script = s;
					server.call('list_questions', [], {}, function(s) {
						question = s;
						server.call('list_spriteids', [], {}, function(s) {
							spriteid = s;
							server.call('list_spriteimages', [], {}, function(s) {
								spriteimage = s;
								server.call('list_images', [], {}, function(i) {
									image = i;
									server.call('list_audio', [], {}, function(a) {
										audio = a;
										document.getElementById('error').style.display = 'none';
										update_ui();
									});
								});
							});
						});
					});
				});
			});
		});
	});
} // }}}
// }}}

// UI. {{{
function GroupRow(id, data) { // {{{
	id = Number(id);
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_group', [], {groupid: id, name: ret.name.value}); };

	// Id.
	ret.AddElement('td').AddText(id);

	// Name.
	ret.name = ret.AddElement('td').AddElement('input');
	ret.name.type = 'text';
	ret.name.value = data.name;
	ret.name.AddEvent('change', ret.update);

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_group', [id], {}, connected);
	});

	return ret;
} // }}}

function ChapterRow(id, data) { // {{{
	id = Number(id);
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_chapter', [], {chapterid: id, name: ret.name.value, parent: Number(ret.parentid.value)}); };

	// Id.
	ret.AddElement('td').AddText(id);

	// Name.
	ret.name = ret.AddElement('td').AddElement('input');
	ret.name.type = 'text';
	ret.name.value = data.name;
	ret.name.AddEvent('change', ret.update);

	// Parent.
	ret.parentid = ret.AddElement('td').AddElement('input');
	ret.parentid.type = 'number';
	ret.parentid.value = data.parentid;
	ret.parentid.AddEvent('change', ret.update);

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_chapter', [id], {}, connected);
	});

	return ret;
} // }}}

function AccessRow(group, chapter) { // {{{
	// Create the object.
	var ret = Create('tr');

	// Group, chapter.
	ret.AddElement('td').AddText(group);
	ret.AddElement('td').AddText(chapter);

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_access', [group, chapter], {}, connected);
	});

	return ret;
} // }}}

function show_errors(errors) {
	if (errors.length > 0) {
		console.info(errors.length + ' error(s) found:\n\t' + errors.join('\n\t'));
		alert(errors.length + ' error(s) found:\n\t' + errors.join('\n\t'));
	}
}

function ScriptRow(id, data) { // {{{
	id = Number(id);
	// Create the object.
	var ret = Create('tr');
	ret.update = function() {
		server.call('update_script', [], {scriptid: id, name: ret.name.value, chapter: Number(ret.chapter.value), script: null}, function(errors) { show_errors(errors); });
	};

	// Id.
	ret.AddElement('td').AddText(id);

	// Name.
	ret.name = ret.AddElement('td').AddElement('input');
	ret.name.type = 'text';
	ret.name.value = data.name;
	ret.name.AddEvent('change', ret.update);

	// Chapter.
	ret.chapter = ret.AddElement('td').AddElement('input');
	ret.chapter.type = 'text';
	ret.chapter.value = data.chapter;
	ret.chapter.AddEvent('change', ret.update);

	// Edit.
	ret.download = ret.AddElement('td').AddElement('button').AddText('Edit');
	ret.download.type = 'button';
	ret.download.AddEvent('click', function() {
		server.call('get_script', [id], {}, function(scriptdata) {
			edit.id = id;
			edit.name = data.name;
			edit.chapter = data.chapter;
			document.getElementById('editbox').value = scriptdata;
			document.getElementById('edit').style.display = 'block';
		});
	});

	// Download.
	ret.download = ret.AddElement('td').AddElement('button').AddText('Download');
	ret.download.type = 'button';
	ret.download.AddEvent('click', function() {
		server.call('get_script', [id], {}, function(data) {
			var a = document.getElementById('download');
			a.href = 'data:text/plain;charset=utf-8;base64,' + btoa(data);
			a.download = ret.name.value + '.txt';
			a.click();
		});
	});

	// Upload.
	ret.upload = ret.AddElement('td').AddElement('input');
	ret.upload.type = 'file';
	ret.upload.AddEvent('change', function() {
		var send = function(files, idx) {
			// Finish if the last file has been sent.
			if (idx >= files.length) {
				connected();
				return;
			}
			
			// Read and send the requested file.
			var reader = new FileReader();
			reader.AddEvent('load', function() {
				// Send the requested file.
				server.call('update_script', [], {scriptid: id, name: ret.name.value, chapter: ret.chapter.value, script: reader.result}, function(errors) {
					show_errors(errors);
					// Continue with next file.
					send(files, idx + 1);
				});
			});
			reader.readAsText(files[idx], 'utf-8');
		};
		send(ret.upload.files, 0);
	});

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_script', [id], {}, connected);
	});

	return ret;
} // }}}

function QuestionRow(id, data) { // {{{
	// Create the object.
	var ret = Create('tr');
	var split = id.match(/(\d+):(.*)/);
	var qid = split[2];
	var sid = Number(split[1]);

	// Id, Script, Type, Description.
	ret.AddElement('td').AddText(qid);
	ret.AddElement('td').AddText(sid);
	ret.AddElement('td').AddText(data.type);
	ret.AddElement('td').AddText(data.description);

	return ret;
} // }}}

function SpriteIdRow(id, data) { // {{{
	// Create the object.
	var ret = Create('tr');
	ret.update = function() {
		var sname = ret.name.value;
		var chapter = ret.chapter.value ? Number(ret.chapter.value) : null;
		server.call('update_spriteid', [], {spriteid: id, name: sname, chapter: chapter});
	};

	// Name.
	ret.name = ret.AddElement('td').AddElement('input');
	ret.name.type = 'text';
	ret.name.value = data.name;
	ret.name.AddEvent('change', ret.update);

	// Chapter.
	ret.chapter = ret.AddElement('td').AddElement('input');
	ret.chapter.type = 'Number';
	ret.chapter.value = data.chapter;
	ret.chapter.AddEvent('change', ret.update);

	// Id.
	ret.spriteid = ret.AddElement('td').AddElement('input');
	ret.spriteid.type = 'Number';
	ret.spriteid.value = id;
	ret.spriteid.AddEvent('change', ret.update);

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_sprite', [qid, sid], {}, connected);
	});

	return ret;
} // }}}

function SpriteImageRow(id, data) { // {{{
	// Create the object.
	var ret = Create('tr');
	ret.update = function() {
		var sid = Number(ret.spriteid.value);
		var mood = ret.mood.value;
		var image = Number(ret.image.value);
		server.call('update_spriteimage', [], {spriteimageid: id, spriteid: sid, mood: mood, image: image});
	};

	// Id.
	ret.spriteid = ret.AddElement('td').AddText(id);

	// Sprite ID.
	ret.spriteid = ret.AddElement('td').AddElement('input');
	ret.spriteid.type = 'number';
	ret.spriteid.value = data.spriteid;
	ret.spriteid.AddEvent('change', ret.update);

	// Mood.
	ret.mood = ret.AddElement('td').AddElement('input');
	ret.mood.type = 'text';
	ret.mood.value = data.mood;
	ret.mood.AddEvent('change', ret.update);

	// Image.
	ret.image = ret.AddElement('td').AddElement('input');
	ret.image.type = 'number';
	ret.image.value = data.image;
	ret.image.AddEvent('change', ret.update);

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_sprite', [qid, sid], {}, connected);
	});

	return ret;
} // }}}

function ImageRow(id, data) { // {{{
	console.info(data);
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_image', [], {imageid: id, name: ret.imgname.value, size: [Number(ret.width.value), Number(ret.height.value)], hotspot: [Number(ret.hotx.value), Number(ret.hoty.value)], url: null}); };

	// Id.
	ret.AddElement('td').AddText(id);

	// Name.
	ret.imgname = ret.AddElement('td').AddElement('input');
	ret.imgname.type = 'text';
	ret.imgname.value = data.name;
	ret.imgname.AddEvent('change', ret.update);

	// Width.
	ret.width = ret.AddElement('td').AddElement('input');
	ret.width.type = 'number';
	ret.width.value = data.size[0];
	ret.width.AddEvent('change', ret.update);

	// Height.
	ret.height = ret.AddElement('td').AddElement('input');
	ret.height.type = 'number';
	ret.height.value = data.size[1];
	ret.height.AddEvent('change', ret.update);

	// Hotspot X.
	ret.hotx = ret.AddElement('td').AddElement('input');
	ret.hotx.type = 'number';
	ret.hotx.value = data.hotspot[0];
	ret.hotx.AddEvent('change', ret.update);

	// Hotspot Y.
	ret.hoty = ret.AddElement('td').AddElement('input');
	ret.hoty.type = 'number';
	ret.hoty.value = data.hotspot[1];
	ret.hoty.AddEvent('change', ret.update);

	// Download.
	ret.download = ret.AddElement('td').AddElement('button').AddText('Download');
	ret.download.type = 'button';
	ret.download.AddEvent('click', function() {
		server.call('get_image', [id], {}, function(data) {
			var a = document.getElementById('download');
			var t = data.url.match(/\/(.*?)[,;]/);
			if (t === null) {
				a.href = 'data:application/octet-stream;base64,' + btoa(data);
				a.download = ret.imgname.value + id + '.bin';
			}
			else {
				a.href = data.url;
				a.download = ret.imgname.value + '.' + t[1];
			}
			a.click();
		});
	});

	// Upload.
	ret.upload = ret.AddElement('td').AddElement('input');
	ret.upload.type = 'file';
	ret.upload.AddEvent('change', function() {
		var send = function(files, idx) {
			// Finish if the last file has been sent.
			if (idx >= files.length) {
				connected();
				return;
			}
			
			// Create a data url from the requested file.
			var reader = new FileReader();
			reader.AddEvent('load', function() {
				// Send the requested file.
				server.call('update_image', [], {imageid: id, name: ret.imgname.value, size: [Number(ret.width.value), Number(ret.height.value)], hotspot: [Number(ret.hotx.value), Number(ret.hoty.value)], url: reader.result}, function() {
					// Continue with next file.
					send(files, idx + 1);
				});
			});
			reader.readAsDataURL(files[idx]);
		};
		send(ret.upload.files, 0);
	});

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_image', [id], {}, connected);
	});

	return ret;
} // }}}

function AudioRow(id, data) { // {{{
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_audio', [], {audioid: id, duration: Number(ret.duration.value), url: null}); };

	// Id.
	ret.AddElement('td').AddText(id);

	// Duration.
	ret.duration = ret.AddElement('td').AddElement('input');
	ret.duration.type = 'text';
	ret.duration.value = data.duration;
	ret.duration.AddEvent('change', ret.update);

	// Download.
	ret.download = ret.AddElement('td').AddElement('button').AddText('Download');
	ret.download.type = 'button';
	ret.download.AddEvent('click', function() {
		server.call('get_audio', [id], {}, function(data) {
			var a = document.getElementById('download');
			a.href = data;
			var t = data.match(/\/(.*?)[,;]/);
			if (t === null) {
				a.href = 'data:application/octet-stream;base64,' + btoa(data);
				a.download = id + '.bin';
			}
			else {
				a.href = data;
				a.download = id + '.' + t[1];
			}
			a.click();
		});
	});

	// Upload.
	ret.upload = ret.AddElement('td').AddElement('input');
	ret.upload.type = 'file';
	ret.upload.AddEvent('change', function() {
		var send = function(files, idx) {
			// Finish if the last file has been sent.
			if (idx >= files.length) {
				connected();
				return;
			}
			
			// Create a data url from the requested file.
			var reader = new FileReader();
			reader.AddEvent('load', function() {
				// Send the requested file.
				server.call('update_audio', [], {audioid: id, duration: Number(ret.duration.value), url: reader.result}, function() {
					// Continue with next file.
					send(files, idx + 1);
				});
			});
			reader.readAsDataURL(files[idx]);
		};
		send(ret.upload.files, 0);
	});

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_audio', [id], {}, connected);
	});

	return ret;
} // }}}

function update_ui() { // {{{

	// Groups.
	var table = document.getElementById('group').ClearAll();
	var tr = table.AddElement('tr');
	var titles = ['Id', 'Name', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var g in group)
		table.Add(GroupRow(g, group[g]));
	tr = table.AddElement('tr');
	tr.AddElement('th').AddText('New');
	var input = tr.AddElement('td').AddElement('input');
	input.type = 'text';
	var td = tr.AddElement('td');
	td.colSpan = 2;
	var button = td.AddElement('button').AddText('Create');
	button.input = input;
	button.AddEvent('click', function() { server.call('add_group', [this.input.value], {}, connected); });

	// Chapters.
	table = document.getElementById('chapter').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Name', 'Parent', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var c in chapter)
		table.Add(ChapterRow(c, chapter[c]));
	tr = table.AddElement('tr');
	tr.AddElement('th').AddText('New');
	var td = tr.AddElement('td');
	td.colSpan = 3;
	var button = td.AddElement('button').AddText('Create');
	button.AddEvent('click', function() { server.call('add_chapter', ['New'], {}, connected); });

	// Access.
	table = document.getElementById('access').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Group', 'Chapter', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var a = 0; a < access.length; ++a)
		table.Add(AccessRow(access[a][0], access[a][1]));
	tr = table.AddElement('tr');
	var groupinput = tr.AddElement('td').AddElement('input');
	groupinput.type = 'text';
	var chapterinput = tr.AddElement('td').AddElement('input');
	chapterinput.type = 'text';
	var td = tr.AddElement('td');
	var button = td.AddElement('button').AddText('Create');
	button.AddEvent('click', function() { server.call('add_access', [Number(groupinput.value), Number(chapterinput.value)], {}, connected); });

	// Scripts.
	table = document.getElementById('script').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Name', 'Chapter', 'Edit', 'Download', 'Upload', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var s in script)
		table.Add(ScriptRow(s, script[s]));
	tr = table.AddElement('tr');
	tr.AddElement('th').AddText('New');
	var td = tr.AddElement('td');
	td.colSpan = 6;
	var button = td.AddElement('button').AddText('Create');
	button.AddEvent('click', function() { server.call('add_script', ['New', 0, ''], {}, connected); });

	// Questions.
	table = document.getElementById('question').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Script', 'Type', 'Description'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var q in question)
		table.Add(QuestionRow(q, question[q]));

	// Sprite IDs.
	table = document.getElementById('spriteid').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Name', 'Chapter', 'Id', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var s in spriteid)
		table.Add(SpriteIdRow(s, spriteid[s]));
	tr = table.AddElement('tr');
	tr.AddElement('td').AddText('New ID:').colSpan = 2;
	var td = tr.AddElement('td');
	var input = td.AddElement('input');
	input.type = 'number';
	var td = tr.AddElement('td');
	var button = td.AddElement('button').AddText('Create');
	button.input = input;
	button.AddEvent('click', function() { server.call('add_spriteid', [Number(this.input.value), '', 0], {}, connected); });

	// Sprite Images.
	table = document.getElementById('spriteimage').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Sprite ID', 'Mood', 'Image', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var s in spriteimage)
		table.Add(SpriteImageRow(s, spriteimage[s]));
	tr = table.AddElement('tr');
	tr.AddElement('td').AddText('New:');
	var td = tr.AddElement('td');
	td.colSpan = 4;
	var button = td.AddElement('button').AddText('Create');
	button.input = input;
	button.AddEvent('click', function() { server.call('add_spriteimage', [0, '', 0], {}, connected); });

	// Images.
	table = document.getElementById('image').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Name', 'Width', 'Height', 'Hotspot X', 'Hotspot Y', 'Download', 'Upload', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var i in image)
		table.Add(ImageRow(i, image[i]));
	tr = table.AddElement('tr');
	var input = tr.AddElement('td').AddElement('input');
	input.type = 'text';
	var td = tr.AddElement('td');
	td.colSpan = 8;
	var button = td.AddElement('button').AddText('Create');
	button.input = input;
	button.AddEvent('click', function() { server.call('add_image', [this.input.value, '', '', [0, 0], [0, 0]], {}, connected); });

	// Audio.
	table = document.getElementById('audio').ClearAll();
	tr = table.AddElement('tr');
	titles = ['Id', 'Duration', 'Download', 'Upload', 'Remove'];
	for (var t = 0; t < titles.length; ++t)
		tr.AddElement('th').AddText(titles[t]);
	for (var a in audio)
		table.Add(AudioRow(a, audio[a]));
	tr = table.AddElement('tr');
	var input = tr.AddElement('td').AddElement('input');
	input.type = 'text';
	var td = tr.AddElement('td');
	td.colSpan = 5;
	var button = td.AddElement('button').AddText('Create');
	button.input = input;
	button.AddEvent('click', function() { server.call('add_audio', [this.input.value, '', 0], {}, connected); });

} // }}}

function save() { // {{{ Edit box was changed; save script.
	document.getElementById('save').disabled = true;
	server.call('update_script', [], {scriptid: edit.id, name: edit.name, chapter: edit.chapter, script: document.getElementById('editbox').value}, function(errors) {
		document.getElementById('save').disabled = false;
		show_errors(errors);
		document.getElementById('editbox').focus();
	});
} // }}}

function cursorMove() { // {{{ Key has been released in edit box, so cursor may have moved; update line indicator.
	var content = document.getElementById('editbox');
	var start = [...content.value.substr(0, content.selectionStart).matchAll(/\n/g)].length;
	var end = [...content.value.substr(0, content.selectionEnd).matchAll(/\n/g)].length;
	document.getElementById('line').ClearAll().AddText(start == end ? start + 1 : (start + 1) + ' — ' + (end + 1));
} // }}}

function hide() { // {{{ Hide the edit box.
	document.getElementById('edit').style.display = 'none';
} // }}}
// }}}

// vim: set foldmethod=marker :
