var login, videodiv, video, contents, question, speechbox, speaker, photo, speech;
var server_obj, server;
var kinetic_script = null;
var kinetic_pos = 0;
var kinetic_sprites = {};
var kinetic_end = null;
var classes = {};

var Connection = {
	replaced: function() {
		alert('De verbinding is overgenomen door een nieuwe login');
		init();
	},
	login: function() {
		login.style.display = 'block';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		video.pause();
	},
	contents: function(data) {
		var ul = contents.ClearAll().AddElement('ul');
		for (var d = 0; d < data.length; ++d) {
			var button = ul.AddElement('li').AddElement('button').AddText(data[d]).AddEvent('click', function() {
				server.start(this.section);
			});
			button.section = data[d];
			button.type = 'button';
		}
	},
	main: function() {
		login.style.display = 'none';
		videodiv.style.display = 'none';
		contents.style.display = 'block';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		video.pause();
		for (var s in question.style)
			delete question.style[s];
	},
	style: function(key, value) {
		question.style[key] = value;
	},
	story: function(type, story, options) {
		question.style.display = 'block';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		speechbox.style.display = 'block';
		question.innerHTML = '';
		video.pause();
		kinetic_end = function() {
			var get_value;
			var button_text = 'Antwoord';
			switch (type) {
				case 'longnumber':
					var l = question.AddElement('textarea');
					var e = question.AddElement('input');
					e.type = 'number';
					if (options.length > 0)
						e.step = options[0];
					get_value = function() {
						var ret = Number(e.value);
						if (isNaN(ret))
							return [[null, null], null];
						return [ret, l.value];
					};
					break;
				case 'longchoice':
					var l = question.AddElement('textarea');
					var div = question.AddElement('div');
					for (var o = 0; o < options.length; ++o) {
						var button = div.AddElement('button').AddText(options[o]);
						button.type = 'button';
						button.value = options[o];
						button.AddEvent('click', function() {
							server.answer([this.value, l.value]);
						});
					}
					return;
				case 'longshort':
				case 'longunit':
					var l = question.AddElement('textarea');
					var e = question.AddElement('input');
					e.type = 'text';
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return [null, null];
						e.value = '';
						return [ret, l.value];
					};
					break;
				case 'number':
					var e = question.AddElement('input');
					e.type = 'number';
					if (options.length > 0)
						e.step = options[0];
					get_value = function() {
						var ret = Number(e.value);
						if (isNaN(ret))
							return null;
						return ret;
					};
					break;
				case 'choice':
					var div = question.AddElement('div');
					for (var o = 0; o < options.length; ++o) {
						var button = div.AddElement('button').AddText(options[o]);
						button.type = 'button';
						button.value = options[o];
						button.AddEvent('click', function() {
							server.answer(this.value);
						});
					}
					return;
				case 'short':
				case 'unit':
					var e = question.AddElement('input');
					e.type = 'text';
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return null;
						e.value = '';
						return ret;
					};
					break;
				case 'long': // <textarea>
					var e = question.AddElement('textarea');
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return null;
						e.value = '';
						return ret;
					};
					break;
				case 'text': // Not a real question, just continue.
					question.AddElement('br');
					question.AddElement('button').AddText('Ga Verder').AddEvent('click', function() {
						server.text_done();
					}).type = 'button';
					return;
				default:
					console.error('invalid question type', type);
			}
			question.AddElement('button').AddText(button_text).AddEvent('click', function() {
				var answer = get_value();
				if (answer === null)
					return;
				server.answer(answer);
			}).type = 'button';
		};
		kinetic_script = story;
		kinetic_pos = 0;
		next_kinetic();
	},
	video: function(file) {
		video.src = file;
		video.load();
		videodiv.style.display = 'block';
		contents.style.display = 'none';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		speed(); // Set playback speed.
		video.play();
	},
};

// Script is a list of instructions:
// ['text', speaker, text, image]: speech. with empty speaker, hide speaker box; empty image, hide photo; empty all, hide all.
// ['scene', url]: set new background and remove all sprites. With no url, clear all.
// ['style', speaker, css_tag, value]: set sprite style.
// ['image', tag, url]: set sprite image.
// ['wait', seconds]: wait specified time before next step.

function next_kinetic() {
	while (kinetic_script !== null && kinetic_pos < kinetic_script.length) {
		var cmd = kinetic_script[kinetic_pos++];
		//console.info('kinetic', cmd);
		if (typeof cmd == 'string') {
			question.innerHTML = cmd;
			continue;
		}
		switch(cmd[0]) {
			case 'text':
				finish_moves();
				speaker.style.display = (cmd[1] ? 'inline' : 'none');
				speaker.innerHTML = cmd[1];
				speech.innerHTML = cmd[2];
				photo.style.display = (cmd[3] ? 'block' : 'none');
				photo.src = cmd[3] ? cmd[3] : '';
				return;
			case 'scene':
				var sprites = [];
				for (var s in kinetic_sprites)
					sprites.push(s);
				for (var i = 0; i < sprites.length; ++i)
					kill_sprite(sprites[i]);
				question.style.backgroundImage = cmd[1];
				break;
			case 'style':
				if (cmd[2] == 'transition') {
					kinetic_sprites[cmd[1]].style.transition = cmd[3];
					break;
				}
				classes[cmd[1]][0].style[cmd[2]] = classes[cmd[1]][1].style[cmd[2]];
				classes[cmd[1]][1].style[cmd[2]] = cmd[3];
				kinetic_sprites[cmd[1]].RemoveClass('moved-' + cmd[1]);
				break;
			case 'image':
				if (!(cmd[1] in kinetic_sprites))
					new_sprite(cmd[1]);
				if (cmd[2]) {
					kinetic_sprites[cmd[1]].src = cmd[2];
					classes[cmd[1]][0].style.marginLeft = '-' + (kinetic_sprites[cmd[1]].width / 2) + 'px';
				}
				else
					kill_sprite(cmd[1]);
				break;
			case 'wait':
				setTimeout(function() {
					for (var s in kinetic_sprites) {
						kinetic_sprites[s].AddClass('moved-' + s);
					}
					setTimeout(function() {
						finish_moves();
						next_kinetic();
					}, cmd[1] * 1000);
				}, 0);
				return;
			default:
				console.error('invalid kinetic command', cmd);
		}
	}
	if (kinetic_script !== null && kinetic_pos >= kinetic_script.length) {
		kinetic_script = null;
		if (kinetic_end) {
			kinetic_end();
			kinetic_end = null;
		}
	}
}

function prev_kinetic() {
	// TODO.
}

function new_sprite(tag) {
	kinetic_sprites[tag] = question.AddElement('img', 'sprite ' + 'base-' + tag);
	kinetic_sprites[tag].AddEvent('load', function() {
		classes[tag][0].style.marginLeft = '-' + (kinetic_sprites[tag].width / 2) + 'px';
	});
	// If classes are already created, we're done.
	if (tag in classes)
		return;
	// Create two classes for transitions.
	var names = ['.base-' + tag, '.base-' + tag + '.moved-' + tag];
	classes[tag] = [];
	for (var i = 0; i < names.length; ++i) {
		document.styleSheets[0].insertRule(names[i] + ' {}', i);
		classes[tag].push(document.styleSheets[0].cssRules[i]);
	}
}

function kill_sprite(tag) {
	question.removeChild(kinetic_sprites[tag]);
	delete kinetic_sprites[tag];
}

function finish_moves() {
	for (var s in kinetic_sprites) {
		for (var st in classes[s][1].style)
			classes[s][0].style[st] = classes[s][1].style[st];
		// restore margin-left.
		classes[s][0].style.marginLeft = '-' + (kinetic_sprites[s].width / 2) + 'px';
		kinetic_sprites[s].RemoveClass('moved-' + s);
	}
}

function init() {
	login = document.getElementById('login');
	videodiv = document.getElementById('video');
	video = document.getElementsByTagName('video')[0];
	contents = document.getElementById('contents');
	question = document.getElementById('question');
	speechbox = document.getElementById('speechbox');
	speaker = document.getElementById('speaker');
	photo = document.getElementById('photo');
	speech = document.getElementById('speech');
	server_obj = Rpc(Connection, null, connection_lost);
	server = server_obj.proxy;
	kinetic_script = null;
	kinetic_pos = 0;
	kinetic_sprites = {};

	login.style.display = 'none';
	videodiv.style.display = 'none';
	contents.style.display = 'none';
	question.style.display = 'none';
	speechbox.style.display = 'none';
	speaker.style.display = 'none';

	window.AddEvent('keypress', function(event) {
		//console.info(event);
		if (event.charCode != 32 && event.keyCode != 8)
			return;
		if (kinetic_script === null)
			return;
		event.preventDefault();
		if (event.charCode == 32)
			next_kinetic();
		else
			prev_kinetic();
	});
	window.AddEvent('click', function(event) {
		if (event.button != 0)
			return;
		if (kinetic_script === null)
			return;
		event.preventDefault();
		next_kinetic();
	});
}
window.AddEvent('load', init);

function connection_lost() {
	alert('De verbinding met de server is verbroken.');
}

function log_in() {
	var loginname = document.getElementById('loginname').value;
	var group = document.getElementById('class').value;
	var password = document.getElementById('password').value;
	server.login(loginname, group, password);
	return false;
}

function speed() {
	var factor = Number(document.getElementById('speed').value) / 100;
	if (factor > 0)
		video.playbackRate = factor;
}

function video_done() {
	video.pause();
	server.video_done();
}

// vim: set foldmethod=marker foldmarker={,} :
