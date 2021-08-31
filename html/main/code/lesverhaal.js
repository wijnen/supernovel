"use strict";
// Globals. {{{

var server;	// Handle for server communication.
var sprite = {};	// All screen sprites.
var img_cache = {};	// Cache of loaded images; keys are urls, values are data urls.

// DOM elements.
var error, login, videodiv, video;
var contents, contentslist, question, navigation;
var spritebox, sandbox, speechbox, speaker, speaker_image, speech, bg, game;
var music, sound;

// Threads.
var state, prev_states;

// Flags.
var is_replaced;	// Flag to avoid stealing back the connection after replacing it.
var animating = false;	// Flag to disable animation handling when there is nothing to animate.

// }}}

function SpriteState(ref) { // {{{
	// Class that holds the state of a sprite and can interpolate.
	// Construct with new.
	if (ref === undefined) {
		this.image = {url: '', size: null, hotspot: [.5, 0]}
		this.position = [[0, 0], [0, 0], 0];
		this.rotation = 0;
		this.around = null;
		this.scale = [1, 1];
	}
	else {
		var copy_array = function(src) {
			if (src === null)
				return null;
			var ret = [];
			for (var i = 0; i < src.length; ++i)
				ret.push(src[i]);
			return ret;
		};
		this.image = ref.image;
		this.position = [copy_array(ref.position[0]), copy_array(ref.position[1]), ref.position[2]];
		this.rotation = ref.rotation;
		this.around = copy_array(ref.around);
		this.scale = copy_array(ref.scale);
	}
	var mix_num = function(phase, a, b) {
		if (b === null)
			return a;
		if (a === null)
			return b;
		return a + (b - a) * phase;
	};
	var mix_array = function(phase, a, b) {
		if (b === null)
			return a;
		if (a === null)
			return b;
		var ret = [];
		for (var i = 0; i < a.length; ++i)
			ret.push(mix_num(phase, a[i], b[i]));
		return ret;
	};
	this.mix = function(phase, to) {
		// TODO: handle non-linear interpolation ("with").
		var ret = new SpriteState();
		ret.position = [mix_array(phase, this.position[0], to.position[0]), mix_array(phase, this.position[1], to.position[1]), mix_num(phase, this.position[2], to.position[2])];
		ret.rotation = mix_num(phase, this.rotation, to.rotation);
		ret.around = mix_array(phase, this.around, to.around);
		ret.scale = mix_array(phase, this.scale, to.scale);
		ret.image = to.image;
		//console.info(phase, this.position[0], to.position[0], ret.position[0]);
		return ret;
	};
} // }}}

function Sprite(ref) { // {{{
	// Class that defines one sprite in a state. It does not contain display parts.
	// Construct with new.
	if (ref) {
		this.start_time = ref.start_time;
		this.duration = ref.duration;
		this.method = ref.method;
		this.from = new SpriteState(ref.from);
		this.to = new SpriteState(ref.to);
		this.cb = ref.cb;
		this.size = ref.size;
	}
	else {
		this.start_time = null;
		this.duration = null;
		this.method = null;
		this.from = new SpriteState();
		this.to = new SpriteState();
		this.cb = null;
		this.size = null;
	}
	this.state = function(now) {
		// Compute current state at time now.
		var ret;
		if (this.start_time === null || this.duration === null || this.method === null) {
			ret = new SpriteState(this.from);
			ret.extra = null;
		}
		else {
			animating = true;
			var phase = (now - this.start_time) / this.duration;
			if (phase >= 1) {
				ret = new SpriteState(this.to);
				ret.extra = now - this.start_time - this.duration;
				this.start_time = null;
				this.duration = null;
				this.method = null;
				this.from = new SpriteState(this.to);
			}
			else {
				ret = this.from.mix(phase, this.to);
				ret.extra = null;
			}
		}
		return ret;
	};
} // }}}

function get_img(url, cb) { // {{{
	// Get an image from the cache, or load it if it wasn't in the cache yet.
	// Call cb when the image is loaded. Its argument is the image with attributes url (the data url) and size (w x h).
	// Returns undefined.
	if (img_cache[url] !== undefined) {
		setTimeout(function() { cb(img_cache[url]); }, 0);
		return;
	}
	var xhr = new XMLHttpRequest();
	xhr.AddEvent('loadend', function() {
		var reader = new FileReader();
		reader.AddEvent('load', function() {
			var tmp = Create('img');
			tmp.src = reader.result;
			var w = tmp.width;
			var h = tmp.height;
			var img = {url: reader.result, size: [w, h]};
			img_cache[url] = img;
			cb(img);
		});
		reader.readAsDataURL(xhr.response);
	});
	xhr.responseType = 'blob';
	xhr.open('GET', url, true);
	xhr.send();
} // }}}

function DisplaySprite() { // {{{
	// Class that defines one sprite that is currently displayed.
	// Construct with new.
	var me = this;
	this.div = spritebox.AddElement('div', 'sprite');
	this.img = this.div.AddElement('img');
	this.update = function(sprite, now) {
		// Update this sprite according to a state Sprite.
		this.cb = sprite.cb;
		var sprite_state = sprite.state(now);
		me.div.style.zIndex = sprite_state.position[2];
		//console.info(sprite_state.image, sprite_state.position[0], sprite_state.position[1]);
		get_img(sprite_state.image.url, function(img) {
			me.img.src = img.url;
			var size;
			if (sprite_state.image.size !== null)
				size = sprite_state.image.size;
			else
				size = [img.size[0] / state.background.size[0], img.size[1] / state.background.size[1]];
			var hotspot = [];
			for (var i = 0; i < 2; ++i) {
				if (sprite_state.position[i][0] == 0)
					hotspot.push(sprite_state.image.hotspot[i]);
				else
					hotspot.push(sprite_state.position[i][0]);
			}
			var x = (sprite_state.position[0][1] + 1) / 2 * 100;
			var hx = (hotspot[0] + 1) / 2 * size[0] * 100;
			var y = sprite_state.position[1][1] * 100;
			var hy = hotspot[1] * size[1] * 100;
			me.div.style.left = (x - hx) + '%';
			me.div.style.bottom = (y - hy) + '%';
		});
		return sprite_state.extra !== null;
	};
	this.remove = function() {
		spritebox.removeChild(this.div);
	};
} // }}}

function State(ref) { // {{{
	// Class that holds an animation state. Construct with new. Main methods:
	// draw: update interface using this state.
	// constructor: create a copy for storing in history, or from restoring from history.
	this.thread = {};	// All running (and paused) threads.
	this.waiting_threads = [];	// Stack of threads that are currently waiting for next_kinetic. Usually length 0 or 1.
	this.show_question = false;	// Flag for next_kinetic to be disabled when a question is shown.
	this.background = (state && state.background ? state.background : {url: '', size: [1280, 1024]});
	this.sprite = {};
	this.speaker = {name: null, image: null, text: null};
	if (ref !== undefined) {
		for (var t in ref.thread)
			this.thread[t] = ref.thread[t];
		for (var w = 0; w < this.waiting_threads.length; ++w)
			this.waiting_threads.push(ref.waiting_threads[w]);
		this.show_question = ref.show_question;
		this.background = ref.background;
		for (var s in ref.sprite)
			this.sprite[s] = new Sprite(ref.sprite[s]);
		this.speaker = {name: ref.speaker.name, image: ref.speaker.image, text: ref.speaker.text};
	}
	this.draw = function(now) { // {{{
		// Update the current screen to this state.
		// Returns undefined.

		// Background.
		if (!this.background)
			this.background = {url: '', size: [1280, 1024]};
		bg.src = this.background.url;
		if (this.background.url)
			bg.RemoveClass('hidden');
		else
			bg.AddClass('hidden');
		resize();

		// Speech.
		speechbox.style.display = 'block';
		if (this.speaker.name) {
			speaker.style.display = 'inline';
			speaker.innerHTML = this.speaker.name;
		}
		else
			speaker.style.display = 'none';
		speech.innerHTML = this.speaker.text;
		if (this.speaker.image) {
			speaker_image.style.display = 'block';
			speaker_image.src = this.speaker.image.url;
		}
		else
			speaker_image.style.display = 'none';

		// Sprites.
		for (var s in sprite) {
			if (this.sprite[s] === undefined)
				sprite[s].remove();
		}
		for (var s in this.sprite) {
			if (sprite[s] === undefined)
				sprite[s] = new DisplaySprite();
			if (sprite[s].update(this.sprite[s], now)) {
				// Animation done; call cb.
				if (sprite[s].cb)
					setTimeout(sprite[s].cb(now, sprite[s].extra), 0);
			}
		}
	}; // }}}
}; // }}}

// Thread handling. {{{
function new_thread(script, cb, name, start) { // {{{
	// Create a new thread.
	// script: the code for the thread.
	// cb: the callback to be called when done.
	// name: the name of the thread (optional).
	// start: the start time (in the past). Defaults to now.
	// returns the actual name of the thread. This is equal to name if it was provided.
	if (name === undefined) {
		n = 0;
		while (state.thread[String(n)] !== undefined)
			n += 1;
		name = String(n);
	}
	console.assert(state.thread[name] === undefined, 'thread name already exists');
	state.thread[name] = {'script': script, 'pos': 0, 'start': start || performance.now(), 'cb': cb || null};
	//console.info('new thread', name, state.thread[name]);
	activate(name);
	if (!animating)
		animate();
	return name;
} // }}}

function activate(name, now, extra) { // {{{
	// Run a thread. This is called when starting a new thread, and when resuming it after a delay or from next_kinetic.
	// name: the thread to activate.
	// now: the time that this activation is supposed to run. This may be (slightly) in the past. (optional)
	// Returns undefined.
	var current = state.thread[name];
	if (now === undefined) {
		now = performance.now();
		current.start = now;
	}
	if (extra === undefined)
		extra = 0;
	now -= extra;
	while (true) {
		var action = current.script[current.pos];
		if (action === undefined) {
			if (current.cb)
				current.cb(now - current.start);
			return;
		}
		current.pos += 1;
		console.info('activating', name, 'action', action);
		if (action.action == 'speech') {
			state.waiting_threads.push(name);
			state.speaker.name = action.speaker;
			state.speaker.text = action.text;
			state.speaker.image = action.image;
			if (action.image !== null) {
				// TODO.
			}
			prev_states.push(new State(state));
			state.draw(now);
			return;
		}
		else if (action.action == 'music') {
			// TODO.
		}
		else if (action.action == 'sound') {
			// TODO.
		}
		else if (action.action == 'serial') {
			new_thread(action.actions, function(extra) {
				activate(name, extra);
			}, name + '+', now);
			return;
		}
		else if (action.action == 'parallel') {
			var wait = action.actions.length;
			for (var a = 0; a < action.actions.length; ++a) {
				new_thread([action.actions[a]], function(extra) {
					if (--wait == 0) {
						activate(name, extra);
					}
				}, name + '+' + a, now)
			}
			return;
		}
		else if (action.action == 'scene') {
			// TODO: transitions.
			get_img('content/' + action.target, function(img) {
				state.background = img;
				resize();
				activate(name, now, 0);
			});
			return;
		}
		else {
			var target = action.target;
			var image = action.image;
			var args = action.args;
			var sprite;
			if (action.action == 'show') {
				if (state.sprite[action.target] === undefined) {
					sprite = new Sprite();
					state.sprite[action.target] = sprite;
					sprite.from.position = args.from;
					sprite.from.image = image;
				}
			}
			else if (action.action == 'hide') {
				// TODO
				sprite = state.sprite[action.target];
			}
			else {
				console.assert(action.action == 'move', 'action must be show, hide, or move; not ' + action.action, action);
				sprite = state.sprite[action.target];
			}
			sprite.to.position = args.to;
			sprite.to.image = image;
			sprite.start_time = now;
			sprite.method = args['with'];
			sprite.size = action.size;
			if (args['in'] !== null) {
				console.assert(typeof args['in'] == 'number');
				sprite.duration = args['in'] * 1000;
				sprite.cb = function(now, extra) { activate(name, now, extra); };
				animate(true);
				return;
			}
		}
	}
} // }}}

function run_story(story, cb) { // {{{
	// Start a new story (single chunk from server: story between two questions).
	// story: code for main thread.
	// cb: callback to be called when story is done.
	// Returns undefined.
	// TODO: fill image cache.
	question.style.display = 'none';
	videodiv.style.display = 'none';
	contents.style.display = 'none';
	game.style.display = '';
	speechbox.style.display = 'none';
	sandbox.style.display = 'none';
	question.innerHTML = '';
	video.pause();
	state = new State();
	prev_states = [];
	new_thread(story, cb, '');
} // }}}
// }}}

// Animation. {{{
function animate(running) { // {{{
	// Start or stop running animations.
	// running: if true, animations will run.
	// Returns undefined.
	if (running == animating)
		return;
	animating = running;
	if (running)
		requestAnimationFrame(update_screen);
} // }}}

function update_screen() { // {{{
	// Handle the screen update.
	// Reschedules itself if animations are still running.
	// Returns undefined.
	if (!animating)
		return;
	animating = false;
	state.draw(performance.now());
	if (animating)
		requestAnimationFrame(update_screen);
} // }}}
// }}}

// Server communication. {{{
var Connection = { // {{{
	replaced: function() {	// Connection has been replaced by new connection.
		is_replaced = true;
		alert('De verbinding is overgenomen door een nieuwe login');
		is_replaced = false;
		Connection.cookie('', '', '');
		server.close();
		init();
	},
	login: function() {	// Player needs to log in.
		error.style.display = 'none';
		login.style.display = 'block';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		question.style.display = 'none';
		game.style.display = 'none';
		sandbox.style.display = 'none';
		video.pause();
		music.pause();
		sound.pause();
	},
	contents: function(data) {	// Update chapter and section contents.
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
	main: function() {	// Show chapter and section selection.
		bg.AddClass('hidden');
		error.style.display = 'none';
		login.style.display = 'none';
		videodiv.style.display = 'none';
		contents.style.display = 'block';
		question.style.display = 'none';
		game.style.display = 'none';
		sandbox.style.display = 'none';
		video.pause();
		music.pause();
		sound.pause();
	},
	question: function(story, text, type, options, last_answer) {
		run_story(story, function() {
			if (state.show_question)
				return;
			state.show_question = true;
			speechbox.style.display = 'none';
			question.innerHTML = text;
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
			var rich = null;
			switch (type) {
				case 'longchoice':
					var div = form.AddElement('div');
					var l = form.AddElement('textarea');
					var choices = [];
					for (var o = 0; o < options.length; ++o) {
						var label = div.AddElement('label', 'longchoice');
						var radio = label.AddElement('input');
						radio.type = 'radio';
						radio.name = 'radio';
						choices.push(radio);
						label.AddText(options[o]);
						div.AddElement('br');
					}
					var button = form.AddElement('p').AddElement('button');
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
					var l = form.AddElement('textarea');
					form.AddElement('br');
					var e = form.AddElement('input');
					e.type = 'text';
					rich = form;
					l.focus();
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return [null, null];
						e.value = '';
						return [ret, l.value];
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
					var e = form.AddElement('input');
					e.type = 'text';
					rich = form;
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
					rich = form;
					e.focus();
					get_value = function() {
						var ret = e.value;
						if (ret == '')
							return null;
						e.value = '';
						return ret;
					};
					break;
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
			if (rich !== null)
				richinput(rich);
		});
	},
	video: function(story, file) {	// Next game item is a video, optionally with a kinetic part before it.
		run_story(story, function() {
			music.pause();
			sound.pause();
			animate(false);
			video.src = file;
			video.load();
			videodiv.style.display = 'block';
			contents.style.display = 'none';
			question.style.display = 'none';
			game.style.display = 'none';
			sandbox.style.display = 'none';
			speed(); // Set playback speed.
			video.play();
		});
	},
	cookie: function(n, g, c) {	// A cookie should be set to make the browser auto-login next time.
		document.cookie = 'name=' + encodeURIComponent(n) + '; sameSite=Strict';
		document.cookie = 'group=' + encodeURIComponent(g) + '; sameSite=Strict';
		document.cookie = 'key=' + encodeURIComponent(c) + '; sameSite=Strict';
	},
}; // }}}

function init() { // {{{
	// Initialize everything.
	// Returns undefined.

	// Fill global variables.
	var varnames = ['error', 'login', 'videodiv', 'video', 'contents', 'chapters', 'sections', 'question', 'speechbox', 'navigation', 'spritebox', 'sandbox', 'speaker', 'speaker_image', 'speech', 'bg', 'game', 'music', 'sound'];
	for (var i = 0; i < varnames.length; ++i)
		window[varnames[i]] = document.getElementById(varnames[i]);

	video.pause();
	music.pause();
	sound.pause();

	error.style.display = 'block';
	login.style.display = 'none';
	videodiv.style.display = 'none';
	contents.style.display = 'none';
	question.style.display = 'none';
	game.style.display = 'none';
	sandbox.style.display = 'none';
	speaker.style.display = 'none';

	// Handle clicks on screen for progression.
	spritebox.AddEvent('click', function(event) {
		if (event.button != 0)
			return;
		if (state.show_question || state.waiting_threads.length == 0)
			return;
		event.preventDefault();
		next_kinetic();
	});
	
	// Parse cookie.
	var c = document.cookie.split(';');
	var crumbs = {};
	for (var i = 0; i < c.length; ++i) {
		var item = c[i].split('=');
		for (var j = 0; j < item.length; ++j)
			item[j] = item[j].replace(/^\s*|\s*$/g, '');	// strip whitespace.
		crumbs[item[0]] = decodeURIComponent(item[1]);
	}
	// Set credentials from cookie if they were empty.
	var loginname = document.getElementById('loginname');
	var group = document.getElementById('class');
	if ('name' in crumbs && loginname.value == '')
		loginname.value = crumbs.name;
	if ('group' in crumbs && group.value == '')
		group.value = crumbs.group;
	var connection_lost = function() { // {{{
		bg.AddClass('hidden');
		if (is_replaced)
			return;
		try {
			error.style.display = 'block';
			login.style.display = 'none';
			videodiv.style.display = 'none';
			contents.style.display = 'none';
			question.style.display = 'none';
			game.style.display = 'none';
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
	} // }}}
	server = Rpc(Connection, null, connection_lost);
} // }}}
window.AddEvent('load', init);

function resize() {
	if (state === undefined)
		state = new State();
	var scale = Math.min(window.innerWidth / state.background.size[0], window.innerHeight / state.background.size[1]);
	game.style.left = (window.innerWidth - state.background.size[0] * scale) / 2 + 'px';
	game.style.top = (window.innerHeight - state.background.size[1] * scale) / 2 + 'px';
	game.style.width = state.background.size[0] * scale + 'px';
	game.style.height = state.background.size[1] * scale + 'px';
}
window.AddEvent('resize', resize);

function log_in() { // {{{
	// The log in button is clicked.
	// Always returns false, to prevent the form from submitting.
	var loginname = document.getElementById('loginname').value;
	var group = document.getElementById('class').value;
	var password = document.getElementById('password').value;
	server.call('login', [loginname, group, password], {}, function(error) {
		if (error)
			alert('Inloggen is mislukt: ' + error);
	});
	return false;
} // }}}

function log_out() { // {{{
	// The log out button is clicked.
	// Returns undefined.
	bg.AddClass('hidden');
	Connection.cookie('', '', '');
	Connection.login();
} // }}}
// }}}

// UI callbacks. {{{
function home() { // {{{
	// The home button was clicked.
	// Returns undefined.
	server.call('home');
} // }}}

function next_kinetic() { // {{{
	// The next button was clicked, or the screen was clicked, or the spacebar was pressed.
	// Returns undefined.
	if (document.activeElement != document.body)
		document.activeElement.blur();
	if (state.show_question || state.waiting_threads.length == 0)
		return;
	activate(state.waiting_threads.pop());
} // }}}

function prev_kinetic(full) { // {{{
	// The prev button was clicked, or backspace was pressed.
	return; // TODO
} // }}}

function keypress(event) { // {{{
	// Key press handler. If the key is space or backspace, do next or prev kinetic.
	// Returns undefined.
	//console.info(event);
	if (state === undefined || state.show_question || (event.charCode != 32 && event.keyCode != 8))
		return;
	if (state.waiting_threads.length == 0)
		return;
	event.preventDefault();
	if (event.charCode == 32)
		next_kinetic();
	else
		prev_kinetic();
} // }}}

function speed() { // {{{
	// Playback speed was changed.
	// Returns undefined.
	var factor = Number(document.getElementById('speed').value) / 100;
	if (factor > 0)
		video.playbackRate = factor;
} // }}}

function video_done() { // {{{
	// Video was done playing, or done was forced by player.
	// Returns undefined.
	video.pause();
	server.call('video_done', []);
} // }}}
// }}}

// Sprites. None of this is currenly called. {{{
function new_sprite(tag) { // {{{
	//console.info('new sprite', tag);
	kinetic_sprites[tag] = spritebox.AddElement('img', 'sprite');
	kinetic_sprites[tag].props = {};
	for (var p in defaults) {
		kinetic_sprites[tag].props[p] = defaults[p];
	}
	kinetic_sprites[tag].AddEvent('load', function() {
		kinetic_sprites[tag].style.marginLeft = '-' + (kinetic_sprites[tag].width / 2) + 'px';
	});
} // }}}

function kill_sprite(tag) { // {{{
	//console.info('killing', tag, kinetic_sprites);
	spritebox.removeChild(kinetic_sprites[tag]);
	delete kinetic_sprites[tag];
} // }}}

function store_sprite(tag) { // {{{
	var s = kinetic_sprites[tag].style;
	return [kinetic_sprites[tag].src, s.left, s.bottom];
} // }}}
// }}}

// vim: set foldmethod=marker :
