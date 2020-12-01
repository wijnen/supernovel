var error, login, videodiv, video, contents, contentslist, question, navigation, spritebox, sandbox, speechbox, speaker, photo, speech;
var music, sound;
var is_replaced;
var server;
var kinetic_script = null;
var kinetic_pos = 0;
var kinetic_sprites = {};
var kinetic_end = null;
var kinetic_history = [];
var preparing_animation;
var show_question = false;
var doing_animation;
var animations = {};
var defaults = {x: 0, y: 0, rotation: 0, scale: 1, url: ''};

var Connection = {
	replaced: function() {
		is_replaced = true;
		alert('De verbinding is overgenomen door een nieuwe login');
		is_replaced = false;
		Connection.cookie('', '', '');
		server.close();
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
			buttons.push(chapters.AddElement('li').AddElement('button', 'chapter').AddText(chapter).AddEvent('click', function() {
				sections.ClearAll();
				for (var b = 0; b < buttons.length; ++b)
					buttons[b].RemoveClass('active');
				this.AddClass('active');
				for (var s = 0; s < data[this.chapter].length; ++s) {
					var section = data[this.chapter][s];
					var button = sections.AddElement('li').AddElement('button', 'script').AddText(section).AddEvent('click', function() {
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
		document.getElementsByTagName('body')[0].style.backgroundImage = '';
		animations = {};
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
		video.pause();
		music.pause();
		sound.pause();
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
			//console.info('kinetic end');
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
					var choices = [];
					for (var o = 0; o < options.length; ++o) {
						var label = div.AddElement('label', 'longchoice');
						var radio = label.AddElement('input');
						radio.type = 'radio';
						radio.name = 'radio';
						choices.push(radio);
						label.AddText(options[o]);
						var button = div.AddElement('button');
						button.type = 'button';
						button.AddText('Answer');
						button.AddEvent('click', function() {
							for (var o = 0; o < choices.length; ++o) {
								if (choices[o].checked)
									break;
							}
							if (o < choices.length)
								server.call('answer', [[o, l.value]]);
							else
								alert('Please select your answer');
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
					var div = form.AddElement('div', 'choicebuttons');
					for (var o = 0; o < options.length; ++o) {
						if (o > 0)
							div.AddElement('br');
						var button = div.AddElement('button', 'choicebutton').AddText(options[o]);
						button.type = 'button';
						button.value = o;
						button.AddEvent('click', function() {
							server.call('answer', [Number(this.value)]);
						});
					}
					if (last_answer != null) {
						div.AddElement('hr');
						var button = div.AddElement('button', 'choicebutton').AddText('Repeat last answer: ' + options[last_answer]);
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
					form.AddElement('button').AddText('Continue').AddEvent('click', function() {
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
				form.AddElement('button').AddText('Repeat last answer: ' + last_answer).AddEvent('click', function() {
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
		document.cookie = 'name=' + encodeURIComponent(n) + '; sameSite=Lax';
		document.cookie = 'group=' + encodeURIComponent(g) + '; sameSite=Lax';
		document.cookie = 'key=' + encodeURIComponent(c) + '; sameSite=Lax';
	},
};

// Script is a list of instructions:
// 'text': question text.
// ['text', speaker, text, image]: speech. with empty speaker, hide speaker box; empty image, hide photo; empty all, hide all.
// ['scene', url]: set new background and remove all sprites. With no url, clear all.
// ['sprite', tag, null]: hide sprite.
// ['sprite', tag, {x, y, rotation, scale, url, animation}]: set sprite properties and optionally start animation.
// ['animation', tag, [{initial}, {time, x, y, rotation, scale, url}, ..., next]]: define canned animation.
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
			case 'sprite':
				var d = new Date();
				var n = d.getTime() / 1000;
				//console.info('changing sprite', cmd[1], 'to', cmd[2]);
				if (cmd[2] === null) {
					// Hide sprite.
					kill_sprite(cmd[1]);
					break;
				}
				if (kinetic_sprites[cmd[1]] === undefined)
					new_sprite(cmd[1]);
				cmd[2].time = 0;
				var anim = null;
				if (cmd[2].animation !== undefined)
					anim = cmd[2].animation;
				var initial = {time: n};
				for (var p in defaults) {
					initial[p] = kinetic_sprites[cmd[1]].props[p];
				}
				kinetic_sprites[cmd[1]].anim = [initial, cmd[2], anim];
				if (!doing_animation)
					screen_update();
				break;
			case 'animation':
				animations[cmd[1]] = cmd[2];
				break;
			case 'wait':
				setTimeout(function() {
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
		kinetic_sprites[spr].style.left = data[1][spr][1];
		kinetic_sprites[spr].style.bottom = data[1][spr][2];
	}
	// Set story position.
	kinetic_pos = data[2];
	next_kinetic();
}

function new_sprite(tag) {
	//console.info('new sprite', tag);
	kinetic_sprites[tag] = spritebox.AddElement('img', 'sprite');
	kinetic_sprites[tag].props = {};
	for (var p in defaults) {
		kinetic_sprites[tag].props[p] = defaults[p];
	}
	kinetic_sprites[tag].AddEvent('load', function() {
		kinetic_sprites[tag].style.marginLeft = '-' + (kinetic_sprites[tag].width / 2) + 'px';
	});
}

function kill_sprite(tag) {
	//console.info('killing', tag, kinetic_sprites);
	spritebox.removeChild(kinetic_sprites[tag]);
	delete kinetic_sprites[tag];
}

function store_sprite(tag) {
	var s = kinetic_sprites[tag].style;
	return [kinetic_sprites[tag].src, s.left, s.bottom];
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
		loginname.value = crumbs.name;
	if ('group' in crumbs && group.value == '')
		group.value = crumbs.group;
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

function Anim(sprite, time, tag) {
	//console.info('new animation', tag, 'for sprite', sprite);
	var anim = animations[tag];
	if (anim === undefined) {
		console.error('using undefined animation', anim);
		return null;
	}
	var ret = [{}];
	for (var p in defaults) {
		ret[0][p] = sprite.props[p];
		//console.info('set', p, 'to', sprite.props[p]);
	}
	for (var a = 0; a < anim.length - 1; ++a) {
		var segment = {};
		for (var i in anim[a]) {
			segment[i] = anim[a][i];
			//console.info('segment', i, 'anim', a, 'value', segment[i]);
		}
		ret.push(segment);
	}
	ret[0].time = time;
	ret.push(anim[anim.length - 1]);
	return ret;
}

function screen_update() {
	var d = new Date();
	var n = d.getTime() / 1000;
	doing_animation = false;
	for (var s in kinetic_sprites) {
		var sprite = kinetic_sprites[s];
		if (sprite.anim === null)
			continue;
		//console.info(s, sprite.anim[0], sprite.anim[1], sprite.anim[2]);
		// s = sprite tag; sprite.anim = [{initial}, {time, url, x, y, rotation, scale}, ..., next_animation]
		// time is the duration of this segment.
		while (sprite.anim.length > 2 && sprite.anim[0].time + sprite.anim[1].time <= n) {
			// Go to next animation segment.
			// First set sprite to the end values of this segment.
			var old = sprite.anim[0];
			var current = sprite.anim[1];
			//console.info(s, 'frame done, move to next', current, sprite.anim[0].time, sprite.anim[1].time, n);
			current.time += old.time;
			if (current.x !== undefined) {
				sprite.style.left = current.x + '%';
			}
			if (current.y !== undefined) {
				sprite.style.bottom = current.y + '%';
			}
			var transform = '';
			if (current.rotation !== undefined) {
				transform += 'rotate(' + current.rotation + 'deg) ';
			}
			if (current.scale !== undefined) {
				transform += 'scale(' + current.scale + ')';
			}
			if (transform != '')
				sprite.style.transform = transform;
			if (current.url !== undefined) {
				sprite.src = current.url;
			}
			for (var p in defaults) {
				if (current[p] === undefined)
					current[p] = old[p];
				sprite.props[p] = current[p];
			}
			sprite.anim.splice(0, 1);
		}
		if (sprite.anim.length > 2) {
			doing_animation = true;
			var old = sprite.anim[0];
			var current = sprite.anim[1];
			var f = (n - old.time) / current.time;
			//console.info(f, old.x, current.x, old.x + (current.x - old.x) * f + '%');
			if (current.x !== undefined) {
				if (old.x !== undefined) {
					// x = old + f * (current - old).
					sprite.style.left = old.x + (current.x - old.x) * f + '%';
				}
				else {
					sprite.style.left = current.x + '%';
				}
			}
			if (current.y !== undefined) {
				if (old.y !== undefined) {
					// y = old + f * (current - old).
					sprite.style.bottom = old.y + (current.y - old.y) * f + '%';
				}
				else {
					sprite.style.bottom = current.y + '%';
				}
			}
			var transform = '';
			if ( current.rotation !== undefined) {
				if (old.rotation !== undefined) {
					// rot = old + f * (current - old).
					transform += 'rotate(' + (old.rotation + (current.rotation - old.rotation) * f) + 'deg) ';
				}
				else {
					transform += 'rotate(' + current.rotation + 'deg) ';
				}
			}
			if (current.scale !== undefined) {
				if (old.scale !== undefined) {
					// scale = old + f * (current - old).
					transform += 'scale(' + (old.scale + (current.scale - old.scale) * f) + ')';
				}
				else {
					transform += 'scale(' + current.scale + ')';
				}
			}
			if (transform != '')
				sprite.style.transform = transform;
			if (current.url !== undefined) {
				if (old.url !== undefined) {
					// Handle dissolve transform.
				}
				else {
					sprite.src = current.url;
				}
			}
		}
		else {
			var next = sprite.anim[1];
			if (next === null) {
				sprite.anim = null;
				continue;
			}
			sprite.anim = Anim(sprite, n, next);
			if (sprite.anim !== null)
				doing_animation = true;
		}
	}
	if (doing_animation)
		requestAnimationFrame(screen_update);
}

// vim: set foldmethod=marker foldmarker={,} :
