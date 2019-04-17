var error, login, videodiv, video, contents, contentslist, question, navigation, spritebox, sandbox, speechbox, speaker, photo, speech;
var music, sound;
var is_replaced;
var server;
var kinetic_script = null;
var kinetic_pos = 0;
var kinetic_sprites = {};
var kinetic_end = null;
var kinetic_history = [];
var classes = {};
var preparing_animation;
var show_question = false;

var Connection = {
	replaced: function() {
		is_replaced = true;
		alert('De verbinding is overgenomen door een nieuwe login');
		is_replaced = false;
		Connection.cookie('', '', '');
		init();
	},
	login: function() {
		kinetic_script = null;
		error.style.display = 'none';
		login.style.display = 'block';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		navigation.style.display = 'none';
		spritebox.style.display = 'none';
		sandbox.style.display = 'none';
		video.pause();
		music.pause();
		sound.pause();
	},
	contents: function(data) {
		chapters.ClearAll();
		sections.ClearAll();
		var chapterlist = [];
		for (var d in data)
			chapterlist.push(d);
		chapterlist.sort();
		var buttons = [];
		for (var c = 0; c < chapterlist.length; ++c) {
			var chapter = chapterlist[c];
			buttons.push(chapters.AddElement('li').AddElement('button').AddText(chapter).AddEvent('click', function() {
				sections.ClearAll();
				for (var b = 0; b < buttons.length; ++b)
					buttons[b].RemoveClass('active');
				this.AddClass('active');
				for (var s = 0; s < data[this.chapter].length; ++s) {
					var section = data[this.chapter][s];
					var button = sections.AddElement('li').AddElement('button').AddText(section).AddEvent('click', function() {
						server.call('start', [[this.chapter, this.section]]);
					});
					button.chapter = this.chapter;
					button.section = section;
					button.type = 'button';
				}
			}));
			buttons[c].chapter = chapter;
			buttons[c].type = 'button';
		}
	},
	main: function() {
		kinetic_script = null;
		error.style.display = 'none';
		login.style.display = 'none';
		videodiv.style.display = 'none';
		contents.style.display = 'block';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		navigation.style.display = 'none';
		spritebox.style.display = 'none';
		sandbox.style.display = 'none';
		console.info('pre-pause', video, music, sound);
		video.pause();
		music.pause();
		sound.pause();
		console.info('post-pause');
		for (var s in question.style)
			delete question.style[s];
	},
	style: function(key, value) {
		question.style[key] = value;
	},
	story: function(type, story, last_answer, options) {
		question.style.display = 'none';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		speechbox.style.display = 'block';
		navigation.style.display = 'block';
		spritebox.style.display = 'block';
		sandbox.style.display = 'none';
		question.innerHTML = '';
		video.pause();
		kinetic_end = function() {
			if (show_question)
				return;
			show_question = true;
			speechbox.style.display = 'none';
			question.style.display = 'block';
			// Clear speech so the old text cannot reappear by accident.
			speaker.style.display = 'none';
			speech.innerHTML = '';
			var get_value;
			var button_text = 'Antwoord';
			var send_answer = function() {
				var answer = get_value();
				if (answer === null)
					return;
				server.call('answer', [answer]);
			}
			var form = question.AddElement('form');
			form.onsubmit = function() {
				send_answer();
				return false;
			}
			switch (type) {
				case 'longnumber':
					var l = form.AddElement('textarea');
					form.AddElement('br');
					var e = form.AddElement('input');
					e.type = 'text';
					l.focus();
					get_value = function() {
						var ret = Number(e.value.replace(',', '.'));
						if (isNaN(ret))
							return [null, l.value];
						return [ret, l.value];
					};
					break;
				case 'longchoice':
					var l = form.AddElement('textarea');
					var div = form.AddElement('div');
					for (var o = 0; o < options.length; ++o) {
						var button = div.AddElement('button', 'choicebutton').AddText(options[o]);
						button.type = 'button';
						button.value = o;
						button.AddEvent('click', function() {
							server.call('answer', [[Number(this.value), l.value]]);
						});
					}
					if (last_answer != null) {
						div.AddElement('hr');
						var button = div.AddElement('button', 'choicebutton').AddText('Herhaal laatste antwoord: ' + last_answer[1] + ': ' + options[last_answer[0]]);
						button.type = 'button';
						button.AddEvent('click', function() {
							server.call('answer', [last_answer]);
						});
					}
					l.focus();
					return;
				case 'longshort':
				case 'longunit':
					var l = form.AddElement('textarea');
					form.AddElement('br');
					var e = form.AddElement('input');
					e.type = 'text';
					l.focus();
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return [null, null];
						e.value = '';
						return [ret, l.value];
					};
					break;
				case 'number':
					var e = form.AddElement('input');
					e.type = 'text';
					e.focus();
					get_value = function() {
						var ret = Number(e.value.replace(',', '.'));
						if (isNaN(ret))
							return null;
						return ret;
					};
					break;
				case 'choice':
					var div = form.AddElement('div');
					for (var o = 0; o < options.length; ++o) {
						var button = div.AddElement('button', 'choicebutton').AddText(options[o]);
						button.type = 'button';
						button.value = o;
						button.AddEvent('click', function() {
							server.call('answer', [Number(this.value)]);
						});
					}
					if (last_answer != null) {
						div.AddElement('hr');
						var button = div.AddElement('button', 'choicebutton').AddText('Herhaal laatste antwoord: ' + options[last_answer]);
						button.type = 'button';
						button.AddEvent('click', function() {
							server.call('answer', [last_answer]);
						});
					}
					return;
				case 'short':
				case 'unit':
					var e = form.AddElement('input');
					e.type = 'text';
					e.focus();
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return null;
						e.value = '';
						return ret;
					};
					break;
				case 'long': // <textarea>
					var e = form.AddElement('textarea');
					e.focus();
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return null;
						e.value = '';
						return ret;
					};
					break;
				case 'text': // Not a real question, just continue.
					form.AddElement('br');
					form.AddElement('button').AddText('Ga Verder').AddEvent('click', function() {
						server.call('text_done', []);
					}).type = 'button';
					return;
				default:
					console.error('invalid question type', type);
			}
			form.AddElement('button').AddText(button_text).AddEvent('click', function() {
				send_answer();
			}).type = 'button';
			if (last_answer != null) {
				form.AddElement('button').AddText('Herhaal vorige antwoord: ' + last_answer).AddEvent('click', function() {
					server.call('answer', [last_answer]);
				}).type = 'button';
			}
		};
		kinetic_script = story;
		kinetic_pos = 0;
		show_question = false;
		preparing_animation = false;
		kinetic_history = [];
		next_kinetic(true);
	},
	video: function(file) {
		music.pause();
		sound.pause();
		kinetic_script = null;
		video.src = file;
		video.load();
		videodiv.style.display = 'block';
		contents.style.display = 'none';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		navigation.style.display = 'none';
		spritebox.style.display = 'none';
		sandbox.style.display = 'none';
		speed(); // Set playback speed.
		video.play();
	},
	cookie: function(n, g, c) {
		document.cookie = 'name=' + encodeURIComponent(n);
		document.cookie = 'group=' + encodeURIComponent(g);
		document.cookie = 'key=' + encodeURIComponent(c);
	},
};

// Script is a list of instructions:
// ['text', speaker, text, image]: speech. with empty speaker, hide speaker box; empty image, hide photo; empty all, hide all.
// ['scene', url]: set new background and remove all sprites. With no url, clear all.
// ['style', tag, css_tag, value]: set sprite style.
// ['image', tag, url]: set sprite image.
// ['pre-wait']: wait for next animation frame, to make sure all prepared style attributes are applied.
// ['wait', seconds]: wait specified time before next step.

function home() {
	server.call('home');
}

function next_kinetic(force) {
	if (document.activeElement != document.body)
		document.activeElement.blur();
	if (show_question || (!force && in_kinetic))
		return;
	in_kinetic = true;
	show_question = false;
	while (kinetic_script !== null && kinetic_pos < kinetic_script.length) {
		var cmd = kinetic_script[kinetic_pos++];
		//console.info('kinetic', force, cmd);
		if (typeof cmd == 'string') {
			question.innerHTML = cmd;
			continue;
		}
		speechbox.style.display = 'block';
		question.style.display = 'none';
		switch (cmd[0]) {
			case 'text':
				finish_moves();
				speaker.innerHTML = cmd[1];
				speaker.style.display = (cmd[1] ? 'inline' : 'none');
				speech.innerHTML = cmd[2];
				photo.style.display = (cmd[3] ? 'block' : 'none');
				photo.src = cmd[3] ? cmd[3] : '';
				in_kinetic = false;
				// Record state.
				var sprites = {};
				for (var s in kinetic_sprites)
					sprites[s] = store_sprite(s);
				var bg = document.getElementsByTagName('body')[0].style.backgroundImage;
				kinetic_history.push([bg, sprites, kinetic_pos - 1]);
				if (force != 'finish')
					return;
				break;
			case 'scene':
				var sprites = [];
				for (var s in kinetic_sprites)
					sprites.push(s);
				for (var i = 0; i < sprites.length; ++i)
					kill_sprite(sprites[i]);
				//console.info('scene', cmd[1]);
				document.getElementsByTagName('body')[0].style.backgroundImage = cmd[1] === null ? '' : 'url(' + encodeURI(cmd[1]) + ')';
				break;
			case 'style':
				//console.info(preparing_animation, 'style', cmd[1], cmd[2], cmd[3]);
				if (cmd[2] == 'transition') {
					kinetic_sprites[cmd[1]].style.transition = cmd[3];
					break;
				}
				classes[cmd[1]][0].style[cmd[2]] = (preparing_animation ? classes[cmd[1]][1].style[cmd[2]] : cmd[3]);
				kinetic_sprites[cmd[1]].RemoveClass('moved-' + cmd[1]);
				classes[cmd[1]][1].style[cmd[2]] = cmd[3];
				break;
			case 'image':
				//console.info('image', cmd[1], cmd[2]);
				if (!(cmd[1] in kinetic_sprites))
					new_sprite(cmd[1]);
				if (cmd[2]) {
					kinetic_sprites[cmd[1]].src = cmd[2];
					classes[cmd[1]][0].style.marginLeft = '-' + (kinetic_sprites[cmd[1]].width / 2) + 'px';
				}
				else
					kill_sprite(cmd[1]);
				break;
			case 'pre-wait':
				//console.info('pre-wait');
				preparing_animation = true;
				if (force != 'finish') {
					// Wait two animation frames, just to be sure.
					requestAnimationFrame(function() {
						requestAnimationFrame(function() {
							next_kinetic(true);
						});
					});
					return;
				}
				break;
			case 'wait':
				//console.info('wait');
				for (var s in kinetic_sprites) {
					kinetic_sprites[s].AddClass('moved-' + s);
				}
				preparing_animation = false;
				if (force == 'finish') {
					finish_moves();
					break;
				}
				setTimeout(function() {
					finish_moves();
					next_kinetic(true);
				}, cmd[1] * 1000);
				return;
			case 'music':
				music.pause();
				if (cmd[1] !== null) {
					music.src = cmd[1];
					music.play();
				}
				break;
			case 'sound':
				sound.pause();
				if (cmd[1]) {
					sound.src = cmd[1];
					sound.play();
				}
				break;
			default:
				console.error('invalid kinetic command', cmd);
		}
	}
	in_kinetic = false;
	if (kinetic_script !== null && kinetic_pos >= kinetic_script.length) {
		if (kinetic_end) {
			kinetic_end();
		}
	}
}

function prev_kinetic(full) {
	if (document.activeElement != document.body)
		document.activeElement.blur();
	show_question = false;
	// Throw out the current frame, if there is one.
	if (kinetic_pos < kinetic_script.length)
		kinetic_history.pop();
	// Use last frame, or if there is none, go back to start.
	// The last frame will be rebuilt, so remove it from the stack.
	var data;
	if (!full && kinetic_history.length > 0)
		data = kinetic_history.pop();
	else {
		// Full rewind: remove all history.
		kinetic_history = [];
		data = ['', {}, 0];
	}
	// Remove all sprites.
	var sprites = [];
	for (var s in kinetic_sprites)
		sprites.push(s);
	for (var i = 0; i < sprites.length; ++i)
		kill_sprite(sprites[i]);
	// Set the background.
	document.getElementsByTagName('body')[0].style.backgroundImage = data[0];
	// Create all sprites.
	for (var spr in data[1]) {
		new_sprite(spr);
		kinetic_sprites[spr].src = data[1][spr][0];
		var s = classes[spr];
		for (var i = 0; i < 2; ++i) {
			s[i].style.left = data[1][spr][1];
			s[i].style.top = data[1][spr][2];
			s[i].style.right = data[1][spr][3];
			s[i].style.bottom = data[1][spr][4];
			s[i].style.width = data[1][spr][5];
			s[i].style.height = data[1][spr][6];
		}
	}
	// Set story position.
	kinetic_pos = data[2];
	next_kinetic();
}

function new_sprite(tag) {
	kinetic_sprites[tag] = spritebox.AddElement('img', 'sprite ' + 'base-' + tag);
	kinetic_sprites[tag].AddEvent('load', function() {
		if (kinetic_sprites[tag] !== undefined)
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
	spritebox.removeChild(kinetic_sprites[tag]);
	delete kinetic_sprites[tag];
}

function store_sprite(tag) {
	var s = classes[tag][0].style;
	return [kinetic_sprites[tag].src, s.left, s.top, s.right, s.bottom, s.width, s.height];
}

function finish_moves() {
	for (var s in kinetic_sprites) {
		for (var st in classes[s][1].style) {
			try {
				classes[s][0].style[st] = classes[s][1].style[st];
			}
			catch(e) {
				//console.warn('error finishing move:', s, st, e, classes[s][0].style);
			}
		}
		// restore margin-left.
		classes[s][0].style.marginLeft = '-' + (kinetic_sprites[s].width / 2) + 'px';
		kinetic_sprites[s].RemoveClass('moved-' + s);
	}
	in_kinetic = false;
}

function strip(str) {
	return str.replace(/^\s*|\s*$/g, '');
}

function init() {
	error = document.getElementById('error');
	login = document.getElementById('login');
	videodiv = document.getElementById('video');
	video = document.getElementsByTagName('video')[0];
	contents = document.getElementById('contents');
	chapters = document.getElementById('chapters');
	sections = document.getElementById('sections');
	question = document.getElementById('question');
	speechbox = document.getElementById('speechbox');
	navigation = document.getElementById('navigation');
	spritebox = document.getElementById('spritebox');
	sandbox = document.getElementById('sandbox');
	speaker = document.getElementById('speaker');
	photo = document.getElementById('photo');
	speech = document.getElementById('speech');
	music = document.getElementById('music');
	sound = document.getElementById('sound');
	video.pause();
	music.pause();
	sound.pause();
	server = Rpc(Connection, null, connection_lost);
	kinetic_script = null;
	kinetic_pos = 0;
	kinetic_sprites = {};

	error.style.display = 'block';
	login.style.display = 'none';
	videodiv.style.display = 'none';
	contents.style.display = 'none';
	question.style.display = 'none';
	speechbox.style.display = 'none';
	navigation.style.display = 'none';
	spritebox.style.display = 'none';
	sandbox.style.display = 'none';
	speaker.style.display = 'none';

	spritebox.AddEvent('click', function(event) {
		if (event.button != 0)
			return;
		if (kinetic_script === null)
			return;
		event.preventDefault();
		next_kinetic(false);
	});
	
	var c = document.cookie.split(';');
	var crumbs = {};
	for (var i = 0; i < c.length; ++i) {
		var item = c[i].split('=');
		for (var j = 0; j < item.length; ++j)
			item[j] = strip(item[j]);
		crumbs[item[0]] = item[1];
	}
	var loginname = document.getElementById('loginname');
	var group = document.getElementById('class');
	if ('name' in crumbs && loginname.value == '')
		loginname.value = crumbs['name'];
	if ('group' in crumbs && group.value == '')
		group.value = crumbs['group'];
}
window.AddEvent('load', init);

function keypress(event) {
	//console.info(event);
	if (show_question || (event.charCode != 32 && event.keyCode != 8))
		return;
	if (kinetic_script === null)
		return;
	event.preventDefault();
	if (event.charCode == 32)
		next_kinetic(false);
	else
		prev_kinetic();
}

function connection_lost() {
	if (is_replaced)
		return;
	try {
		error.style.display = 'block';
		login.style.display = 'none';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		question.style.display = 'none';
		speechbox.style.display = 'none';
		navigation.style.display = 'none';
		spritebox.style.display = 'none';
		sandbox.style.display = 'none';
		video.pause();
		music.pause();
		sound.pause();
		server = Rpc(Connection, null, connection_lost);
	}
	catch (err) {
		try {
			alert('De verbinding met de server is verbroken en kan niet worden hersteld.');
		}
		catch (err) {
		}
	}
}

function log_in() {
	var loginname = document.getElementById('loginname').value;
	var group = document.getElementById('class').value;
	var password = document.getElementById('password').value;
	server.call('login', [loginname, group, password], {}, function(error) {
		if (error)
			alert('Inloggen is mislukt: ' + error);
	});
	return false;
}

function log_out() {
	Connection.cookie('', '', '');
	Connection.login();
}

function speed() {
	var factor = Number(document.getElementById('speed').value) / 100;
	if (factor > 0)
		video.playbackRate = factor;
}

function video_done() {
	video.pause();
	server.call('video_done', []);
}

// vim: set foldmethod=marker foldmarker={,} :
