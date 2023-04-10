"use strict";

// Globals. {{{

var server;	// Handle for server communication.
var group, chapter, access, script, question, sprite, image, audio;	// Results of list_*()
var access_lookup;	// {group: [chapter, ...], ...}
var edit = {};	// Current contents of script editing window.
var permissions = {};
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

function update_groups() { // {{{
	server.call('list_groups', [], {}, function(g) {
		group = g;
		server.call('list_chapters', [], {}, function(c) {
			chapter = c;
			server.call('list_access', [], {}, function(a) {
				access = a;
				if (permissions.edit)
					update_edit();
				else {
					document.getElementById('error').style.display = 'none';
					update_ui();
				}
			});
		});
	});
} // }}}

function update_edit() { // {{{
	server.call('list_scripts', [], {}, function(s) {
		script = s;
		server.call('list_questions', [], {}, function(s) {
			question = s;
			server.call('list_sprites', [], {}, function(s) {
				sprite = s;
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
} // }}}

function connected() { // {{{
	server.call('get_permissions', [], {}, function(p) {
		// Return value is an object with attributes 'group' and 'edit' set to true or undefined.
		permissions = p;
		if (permissions.group)
			update_groups();
		else if (permissions.edit)
			update_edit();
		else {
			document.getElementById('error').style.display = 'none';
			update_ui();
		}
	});
} // }}}
// }}}

// UI. {{{
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

	// Export.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Export');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('export_chapter', [id], {}, function(zip) {
			var a = document.getElementById('download');
			a.href = zip;
			a.download = ret.name.value + '.zip';
			a.click();
		});
	});

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_chapter', [id], {}, connected);
	});

	return ret;
} // }}}

function AccessRow(groupid, data) { // {{{
	groupid = Number(groupid);
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_group', [], {groupid: groupid, name: ret.name.value}); };

	// Id.
	ret.AddElement('td').AddText(groupid);

	// Name.
	ret.name = ret.AddElement('td').AddElement('input');
	ret.name.type = 'text';
	ret.name.value = data.name;
	ret.name.AddEvent('change', ret.update);

	// Chapter access.
	for (var c in chapter) {
		var td = ret.AddElement('td');
		td.style.textAlign = 'center';
		var box = td.AddElement('input');
		box.type = 'checkbox';
		box.chapter = c;
		if (access_lookup[groupid][c])
			box.checked = true;
		box.AddEvent('change', function() {
			if (this.checked) {
				server.call('add_access', [Number(groupid), this.chapter], {}, connected);
			}
			else {
				server.call('remove_access', [Number(groupid), this.chapter], {}, connected);
			}
		});
	}

	// Remove.
	ret.remove = ret.AddElement('td').AddElement('button').AddText('Remove');
	ret.remove.type = 'button';
	ret.remove.AddEvent('click', function() {
		server.call('remove_group', [groupid], {}, connected);
	});

	return ret;
} // }}}

function show_errors(errors) { // {{{
	if (errors.length > 0) {
		console.info(errors.length + ' error(s) found:\n\t' + errors.join('\n\t'));
		alert(errors.length + ' error(s) found:\n\t' + errors.join('\n\t'));
	}
} // }}}

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

function ImageRow(id, data, is_first, num_moods) { // {{{
	// Create the object.
	var ret = Create('tr');
	ret.update = function() { server.call('update_image', [], {imageid: id, sprite: data.sprite, mood: ret.mood.value, size: [Number(ret.width.value), Number(ret.height.value)], hotspot: [Number(ret.hotx.value), Number(ret.hoty.value)], url: null}); };
	ret.update_sprite = function() {
		var sname = ret.sprite_name.value;
		var stag = ret.sprite_tag.value;
		var chapter = ret.chapter.value ? Number(ret.chapter.value) : null;
		server.call('update_sprite', [], {spriteid: data.sprite, tag: stag, name: sname, chapter: chapter || null});
	};

	if (is_first) {
		var rows = (num_moods == 0 ? 2 : num_moods + 1);
		var s = sprite[data.sprite];
		// Sprite Id.
		ret.AddElement('td').AddText(data.sprite).rowSpan = rows;

		// Sprite Tag.
		var td = ret.AddElement('td');
		td.rowSpan = rows;
		ret.sprite_tag = td.AddElement('input');
		ret.sprite_tag.value = s.tag;
		ret.sprite_tag.type = 'text';
		ret.sprite_tag.AddEvent('change', ret.update_sprite);

		// Sprite Name.
		var td = ret.AddElement('td');
		td.rowSpan = rows;
		ret.sprite_name = td.AddElement('input');
		ret.sprite_name.value = s.name;
		ret.sprite_name.type = 'text';
		ret.sprite_name.AddEvent('change', ret.update_sprite);

		// Chapter.
		td = ret.AddElement('td');
		td.rowSpan = rows;
		ret.chapter = td.AddElement('input');
		ret.chapter.type = 'Number';
		ret.chapter.value = s.chapter;
		ret.chapter.AddEvent('change', ret.update_sprite);

		// Remove.
		td = ret.AddElement('td');
		td.rowSpan = rows;
		ret.sprite_remove = td.AddElement('button').AddText('Remove');
		ret.sprite_remove.type = 'button';
		ret.sprite_remove.AddEvent('click', function() {
			server.call('remove_sprite', [data.sprite], {}, connected);
		});
	}

	if (num_moods == 0)
		return ret;

	// Id.
	ret.AddElement('td').AddText(id);

	// Mood.
	ret.mood = ret.AddElement('td').AddElement('input');
	ret.mood.type = 'text';
	ret.mood.value = data.mood;
	ret.mood.AddEvent('change', ret.update);

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

	// Preview.
	ret.preview = ret.AddElement('td').AddElement('button').AddText('Preview');
	ret.preview.type = 'button';
	ret.preview.AddEvent('click', function() {
		server.call('get_image', [id], {}, function(data) {
			var img = document.getElementById('preview');
			img.src = data.url;
			img.style.display = 'block';
		});
	});

	// Download.
	ret.download = ret.AddElement('td').AddElement('button').AddText('Download');
	ret.download.type = 'button';
	ret.download.AddEvent('click', function() {
		server.call('get_image', [id], {}, function(data) {
			var a = document.getElementById('download');
			var t = data.url.match(/\/(.*?)[,;]/);
			if (t === null) {
				a.href = 'data:application/octet-stream;base64,' + btoa(data);
				a.download = ret.mood.value + id + '.bin';
			}
			else {
				a.href = data.url;
				a.download = ret.mood.value + '.' + t[1];
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
				var img = Create('img');
				img.src = reader.result;
				server.call('update_image', [], {imageid: id, sprite: data.sprite, mood: ret.mood.value, size: [Number(img.width), Number(img.height)], hotspot: [Number(img.width) / 2, Number(img.height) / 5], url: reader.result}, function() {
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
	ret.update = function() { server.call('update_audio', [], {audioid: id, name: ret.audioname.value, chapter: Number(ret.chapter.value), duration: Number(ret.duration.value), url: null}); };

	// Id.
	ret.AddElement('td').AddText(id);

	// Name.
	ret.audioname = ret.AddElement('td').AddElement('input');
	ret.audioname.type = 'text';
	ret.audioname.value = data.name;
	ret.audioname.AddEvent('change', ret.update);

	// Chapter.
	ret.chapter = ret.AddElement('td').AddElement('input');
	ret.chapter.type = 'number';
	ret.chapter.value = data.chapter;
	ret.chapter.AddEvent('change', ret.update);

	// Duration.
	ret.duration = ret.AddElement('td').AddElement('input');
	ret.duration.type = 'number';
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

	if (permissions.group) {
		// Chapters. {{{
		table = document.getElementById('chapter').ClearAll();
		tr = table.AddElement('tr');
		titles = ['Id', 'Name', 'Parent', 'Export', 'Remove'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var c in chapter)
			table.Add(ChapterRow(c, chapter[c]));

		// Create button.
		tr = table.AddElement('tr');
		var td = tr.AddElement('td');
		td.colSpan = 5;
		var button = td.AddElement('button').AddText('Create Chapter');
		button.AddEvent('click', function() { server.call('add_chapter', ['New', null], {}, connected); });

		// Import button.
		tr = table.AddElement('tr');
		tr.AddElement('th').AddText('Import').colSpan = 2;
		var td = tr.AddElement('td');
		td.colSpan = 3;
		var import_input = td.AddElement('input');
		import_input.type = 'file';
		import_input.AddEvent('change', function() {
			var send = function(files, idx) {
				// Finish if the last file has been sent.
				if (idx >= files.length) {
					document.getElementById('busy').style.display = 'none';
					connected();
					return;
				}

				// Read and send the requested file.
				var reader = new FileReader();
				reader.AddEvent('load', function() {
					// Send the requested file.
					server.call('import_chapter', [btoa(reader.result)], {}, function(errors) {
						show_errors(errors);
						// Continue with next file.
						send(files, idx + 1);
					});
				});
				reader.readAsBinaryString(files[idx]);
			};
			document.getElementById('busy').style.display = 'block';
			send(import_input.files, 0);
		});
		// }}}
		// Groups and access. {{{
		access_lookup = {};
		for (var g in group)
			access_lookup[g] = {};
		for (var a = 0; a < access.length; ++a) {
			if (access_lookup[access[a][0]] === undefined) {
				console.error('Access defined for unknown group', access[a]);
				continue;
			}
			access_lookup[access[a][0]][access[a][1]] = true;
		}
		var table = document.getElementById('access').ClearAll();
		var tr = table.AddElement('tr');
		var titles = ['Group Id', 'Group Name'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var c in chapter)
			tr.AddElement('th').AddText(chapter[c].name);
		tr.AddElement('th').AddText('Remove');
		for (var g in group)
			table.Add(AccessRow(g, group[g]));
		tr = table.AddElement('tr');
		var td = tr.AddElement('td');
		td.colSpan = 4;
		var button = td.AddElement('button').AddText('Create Group');
		button.AddEvent('click', function() { server.call('add_group', [''], {}, connected); });
		// }}}
	}

	if (permissions.edit) {
		// Scripts. {{{
		table = document.getElementById('script').ClearAll();
		tr = table.AddElement('tr');
		titles = ['Id', 'Name', 'Chapter', 'Edit', 'Download', 'Upload', 'Remove'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var s in script)
			table.Add(ScriptRow(s, script[s]));
		tr = table.AddElement('tr');
		var td = tr.AddElement('td');
		td.colSpan = 7;
		var button = td.AddElement('button').AddText('Create Script');
		button.AddEvent('click', function() { server.call('add_script', ['New', 0, ''], {}, connected); });
		// }}}
		// Questions. {{{
		table = document.getElementById('question').ClearAll();
		tr = table.AddElement('tr');
		titles = ['Id', 'Script', 'Type', 'Description'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var q in question)
			table.Add(QuestionRow(q, question[q]));
		// }}}

		// Sprites. {{{
		table = document.getElementById('image').ClearAll();
		tr = table.AddElement('tr');
		titles = ['Id', 'Tag', 'Name', 'Chapter', 'Remove', 'Id', 'Mood', 'Width', 'Height', 'Hotspot X', 'Hotspot Y', 'Preview', 'Download', 'Upload', 'Remove'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var s in sprite) {
			var num = 0;
			for (var i in image) {
				if (image[i].sprite != s)
					continue;
				num += 1;
			}
			var first = true;
			for (var i in image) {
				if (image[i].sprite != s)
					continue;
				table.Add(ImageRow(i, image[i], first, num));
				first = false;
			}

			// Add sprite info if there are no moods, so it can be renamed and removed.
			if (first)
				table.Add(ImageRow(null, {sprite: s}, true, 0));

			tr = table.AddElement('tr');
			var td = tr.AddElement('td');
			td.colSpan = 13;
			var button = td.AddElement('button').AddText('Create Mood');
			button.sprite = s;
			button.AddEvent('click', function() { server.call('add_image', [], {sprite: this.sprite, mood: '', url: '', size: [0, 0], hotspot: [0, 0]}, connected); });
		}
		tr = table.AddElement('tr');
		var td = tr.AddElement('td');
		td.colSpan = 15;
		var button = td.AddElement('button').AddText('Create Sprite');
		button.AddEvent('click', function() { server.call('add_sprite', ['', '', null], {}, connected); });
		// }}}

		// Audio. {{{
		table = document.getElementById('audio').ClearAll();
		tr = table.AddElement('tr');
		titles = ['Id', 'Name', 'Chapter', 'Duration', 'Download', 'Upload', 'Remove'];
		for (var t = 0; t < titles.length; ++t)
			tr.AddElement('th').AddText(titles[t]);
		for (var a in audio)
			table.Add(AudioRow(a, audio[a]));
		tr = table.AddElement('tr');
		var td = tr.AddElement('td');
		td.colSpan = 7;
		var button = td.AddElement('button').AddText('Create Audio');
		button.AddEvent('click', function() { server.call('add_audio', ['', 0, '', 0], {}, connected); });
		// }}}
	}

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
