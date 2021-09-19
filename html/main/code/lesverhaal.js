"use strict";
// Globals. {{{

var server;	// Handle for server communication.
var all_sprites = {};	// All screen sprites.
var img_cache = {};	// Cache of loaded images; keys are urls, values are data urls.
var screen_scale = 1;	// Scale for background and sprites.
var pending_music = null;	// Delay starting music because browsers don't allow it.

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
	this.copy_array = function(src) {
		if (src === null)
			return null;
		var ret = [];
		for (var i = 0; i < src.length; ++i)
			ret.push(src[i]);
		return ret;
	};
	if (ref === undefined) {
		this.image = {url: '', size: null, hotspot: [.5, 0]}
		this.position = [[0, 0], [0, 0], 0];
		this.rotation = 0;
		this.around = null;
		this.scale = [1, 1];
		this['with'] = null;
	}
	else {
		this.image = ref.image;
		if (ref.position === null)
			this.position = null;
		else
			this.position = [this.copy_array(ref.position[0]), this.copy_array(ref.position[1]), ref.position[2]];
		this.rotation = ref.rotation;
		this.around = this.copy_array(ref.around);
		this.scale = this.copy_array(ref.scale);
		this['with'] = ref['with'];
	}
	var mix_num = function(phase, a, b) {
		if (b === null)
			return a;
		if (a === null)
			return b;
		if (typeof a == 'boolean')
			return b;
		if (typeof b == 'boolean')
			return a;
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
	this.mix = function(phase, to, with_) {
		var ret = new SpriteState();
		ret.rotation = mix_num(phase, this.rotation, to.rotation);
		// Don't reuse previous around.
		ret.around = this.copy_array(to.around);
		ret.scale = mix_array(phase, this.scale, to.scale);
		ret.image = to.image;
		if (to.position === null)
			ret.position = this.copy_array(this.position);
		else if (this.position === null)
			ret.position = this.copy_array(to.position);
		else {
			if (with_ == 'move') {
				if (ret.around === null)
					// No rotation: simple interposlation.
					ret.position = [mix_array(phase, this.position[0], to.position[0]), mix_array(phase, this.position[1], to.position[1]), mix_num(phase, this.position[2], to.position[2])];
				else {
					var ratio = state.background.size[1] / state.background.size[0];
					// Rotate around some point. Compute starting and ending angles and radii; mix those.
					var from_vect = [this.position[0][1] - ret.around[0], (this.position[1][1] - ret.around[1]) / ratio];
					var to_vect = [to.position[0][1] - ret.around[0], (to.position[1][1] - ret.around[1]) / ratio];
					var from_angle = Math.atan2(from_vect[1], from_vect[0]);
					var to_angle = Math.atan2(to_vect[1], to_vect[0]);
					if (ret.around[2]) {
						// Clockwise rotation; this means to_angle must be smaller than from_angle.
						if (to_angle > from_angle)
							to_angle -= 2 * Math.PI;
					}
					else {
						// Counter clockwise rotation; this means to_angle must be greater than from_angle.
						if (to_angle < from_angle)
							to_angle += 2 * Math.PI;
					}
					var angle = mix_num(phase, from_angle, to_angle);
					var from_radius = Math.sqrt(from_vect[0] * from_vect[0] + from_vect[1] * from_vect[1]);
					var to_radius = Math.sqrt(to_vect[0] * to_vect[0] + to_vect[1] * to_vect[1]);
					var radius = mix_num(phase, from_radius, to_radius);
					//console.info(from_radius, from_angle, to_radius, to_angle, radius, angle, from_vect, to_vect, this.position, ret.around);
					// Compute position.
					var rpos = [];
					for (var c = 0; c < 2; ++c)
						rpos.push(mix_num(phase, this.position[c][0], to.position[c][0]));
					var x = [rpos[0], ret.around[0] + radius * Math.cos(angle)];
					var y = [rpos[1], ret.around[1] + radius * Math.sin(angle) * ratio];
					var z = mix_num(phase, this.position[2], to.position[2]);
					ret.position = [x, y, z];
				}
			}
			else {
				// TODO: handle non-linear interpolation ("with").
				ret.position = this.copy_array(to.position);
			}
		}
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
		this['with'] = ref['with'];
		this.from = new SpriteState(ref.from);
		this.to = new SpriteState(ref.to);
		this.cb = ref.cb;
		this.size = ref.size;
	}
	else {
		this.start_time = null;
		this.duration = null;
		this['with'] = null;
		this.from = new SpriteState();
		this.to = new SpriteState();
		this.cb = null;
		this.size = null;
	}
	this.state = function(now) {
		// Compute current state at time now.
		var ret;
		if (this.start_time === null || this.duration === null || this['with'] === null) {
			ret = new SpriteState(this.from);
			ret.extra = null;
		}
		else {
			setTimeout(function() { animate(true); }, 0);
			var phase = (now - this.start_time) / this.duration;
			if (phase >= 1) {
				// Don't just copy this.to, because position can be null.
				ret = this.from.mix(1, this.to, null);
				ret.extra = now - this.start_time - this.duration;
				this.start_time = null;
				this.duration = null;
				this['with'] = null;
				this.from = new SpriteState(ret);
			}
			else {
				ret = this.from.mix(phase, this.to, this['with']);
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
	this.update = function(current_sprite, now) {
		// Update this sprite according to a state Sprite.
		this.cb = current_sprite.cb;
		var sprite_state = current_sprite.state(now);
		//console.info(current_sprite, sprite_state);
		if (sprite_state.position === null) {
			console.warn('active sprite has null position', current_sprite);
			return false;
		}
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
			me.div.style.width = screen_scale * size[0] * state.background.size[0] + 'px';
			me.div.style.height = screen_scale * size[1] * state.background.size[1] + 'px';
			me.div.style.transformOrigin = hotspot[0] * 100 + '% ' + (1 - hotspot[1]) * 100 + '%';
			me.div.style.transform = 'rotate(' + sprite_state.rotation * 360 + 'deg)';
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
	this.sleeping_threads = [];	// Sorted list of threads that are in a wait instruction.
	this.show_question = false;	// Flag for next_kinetic to be disabled when a question is shown.
	this.background = (state && state.background ? state.background : {url: '', size: [1280, 1024]});
	this.sprite = {};
	this.speaker = {name: null, image: null, text: null};
	this.music = null;
	if (ref !== undefined) {
		for (var t in ref.thread)
			this.thread[t] = {script: ref.thread[t].script, pos: ref.thread[t].pos, start: ref.thread[t].start, cb: ref.thread[t].cb};
		for (var w = 0; w < ref.waiting_threads.length; ++w)
			this.waiting_threads.push(ref.waiting_threads[w]);
		for (var w = 0; w < ref.sleeping_threads.length; ++w)
			this.sleeping_threads.push(ref.sleeping_threads[w]);
		this.show_question = ref.show_question;
		this.background = ref.background;
		for (var s in ref.sprite)
			this.sprite[s] = new Sprite(ref.sprite[s]);
		this.speaker = {name: ref.speaker.name, image: ref.speaker.image, text: ref.speaker.text};
		this.music = ref.music;
	}
	this.draw = function(now, skip_resize) { // {{{
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
		if (!skip_resize)
			resize();

		// Speech.
		if (this.speaker.name || this.speaker.text)
			speechbox.style.display = 'block';
		else
			speechbox.style.display = 'none';
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
		for (var s in all_sprites) {
			if (this.sprite[s] === undefined) {
				all_sprites[s].remove();
				delete all_sprites[s];
			}
		}
		for (var s in this.sprite) {
			if (all_sprites[s] === undefined)
				all_sprites[s] = new DisplaySprite();
			if (all_sprites[s].update(this.sprite[s], now)) {
				// Animation done; call cb.
				if (all_sprites[s].cb)
					setTimeout(function() { all_sprites[s].cb(now, all_sprites[s].extra); }, 0);
			}
		}

		// If any sleeper is ready, run it.
		while (this.sleeping_threads.length > 0 && this.sleeping_threads[0][0] < now) {
			var w = this.sleeping_threads.splice(0, 1)[0];
			(function (w) { setTimeout(function() { activate(w[1], now, now - w[0], false); }, 0); })(w);
		}
		if (this.sleeping_threads.length > 0)
			setTimeout(function() { animate(true); }, 0);
	}; // }}}
}; // }}}

// Thread handling. {{{
function new_thread(script, cb, name, start, fast_forward) { // {{{
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
	activate(name, undefined, undefined, fast_forward);
	return name;
} // }}}

function activate(name, now, extra, fast_forward) { // {{{
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
			delete state.thread[name];
			if (current.cb)
				current.cb(now - current.start);
			state.draw(now);
			break;
		}
		current.pos += 1;
		//console.info('activating', name, 'action', action);
		if (action.action == 'speech') {
			state.waiting_threads.push(name);
			state.speaker.name = action.speaker;
			state.speaker.text = action.text;
			state.speaker.image = action.image;
			if (action.image !== null) {
				// TODO.
			}
			//console.info('pushing new prev state; waiting:', state.waiting_threads.length);
			prev_states.push(new State(state));
			state.draw(now);
			return;
		}
		else if (action.action == 'wait') {
			if (!fast_forward) {
				console.assert(typeof action.time == 'number', 'value of "time" must be a number');
				state.sleeping_threads.push([now + action.time * 1000, name]);
				state.sleeping_threads.sort();
				break;
			}
			// If fast forwarding, ignore wait instructions.
		}
		else if (action.action == 'music') {
			pending_music = null;
			state.music = action.target;
			if (action.target === null) {
				delete music.src;
				music.pause();
			}
			else {
				music.src = action.target;
				music.play();
			}
		}
		else if (action.action == 'sound') {
			if (action.target === null) {
				delete sound.src;
				sound.pause();
			}
			else {
				sound.src = action.target;
				sound.play();
			}
		}
		else if (action.action == 'serial') {
			new_thread(action.actions, function(extra) {
				activate(name, now, extra, fast_forward);
			}, name + '+', now, fast_forward);
			return;
		}
		else if (action.action == 'parallel') {
			var wait = action.actions.length;
			for (var a = 0; a < action.actions.length; ++a) {
				new_thread([action.actions[a]], function(extra) {
					if (--wait == 0) {
						activate(name, now, extra, fast_forward);
					}
				}, name + '+' + a, now, fast_forward)
			}
			return;
		}
		else if (action.action == 'scene') {
			// TODO: transitions.
			// Remove all sprites.
			for (var s in all_sprites)
				all_sprites[s].remove();
			all_sprites = [];
			// Set new background.
			if (action.target) {
				get_img('content/' + action.target, function(img) {
					state.background = img;
					resize();
					activate(name, now, 0, fast_forward);
				});
			}
			else {
				state.backgorund = null;
				resize();
				activate(name, now, 0, fast_forward);
			}
			return;
		}
		else {
			var target = action.target;
			var image = action.image;
			var args = action.args;
			var current_sprite;
			if (action.action == 'show') {
				if (state.sprite[action.target] === undefined) {
					current_sprite = new Sprite();
					state.sprite[action.target] = current_sprite;
					current_sprite.from.position = args.from;
					current_sprite.from.image = image;
				}
			}
			else if (action.action == 'hide') {
				// TODO
			}
			else {
				console.assert(action.action == 'move', 'invalid action "' + action.action + '"', action);
				// Nothing to prepare; only common handling below is required.
			}
			current_sprite = state.sprite[action.target];
			current_sprite.to.position = args.to;
			current_sprite.to.image = image;
			current_sprite.to.scale = args.scale;
			current_sprite.to.rotation = args.rotation;
			current_sprite.to.around = args.around;
			if (!fast_forward && args['in'] !== null) {
				console.assert(typeof args['in'] == 'number', 'value of "in" must be a number');
				current_sprite.start_time = now;
				current_sprite['with'] = args['with'];
				current_sprite.duration = args['in'] * 1000;
				current_sprite.cb = function(now, extra) { activate(name, now, extra, fast_forward); };
				animate(true);
				break;
			}
			else {
				if (args.to !== null)
					current_sprite.from.position = args.to;
				if (args.scale !== null)
					current_sprite.from.scale = args.scale;
				current_sprite.from.image = image;
				current_sprite.start_time = null;
				current_sprite['with'] = null;
			}
		}
	}
	if (state.waiting_threads.length == 0) {
		state.speaker.name = null;
		state.speaker.text = '';
		state.draw(now);
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
	if (state === undefined)
		state = new State();
	prev_states = [{story: story, cb: cb, background: state.background, music: state.music}];
	state.show_question = false;
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
		state = new State();
		for (var s in all_sprites)
			all_sprites[s].remove();
		all_sprites = [];
		prev_states = [];
	},
	kinetic: function(story, music) {
		//console.info('setup kinetic', music, story)
		server.lock();
		pending_music = music;
		run_story(story, function() { server.unlock(); });
	},
	question: function(story, text, type, options, last_answer) {
		//console.info('question', text, type, story);
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
		if (pending_music !== null) {
			music.src = pending_music;
			pending_music = null;
			music.play();
		}
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

function resize() { // {{{
	if (state === undefined)
		state = new State();
	screen_scale = Math.min(window.innerWidth / state.background.size[0], window.innerHeight / state.background.size[1]);
	game.style.left = (window.innerWidth - state.background.size[0] * screen_scale) / 2 + 'px';
	game.style.top = (window.innerHeight - state.background.size[1] * screen_scale) / 2 + 'px';
	game.style.width = state.background.size[0] * screen_scale + 'px';
	game.style.height = state.background.size[1] * screen_scale + 'px';
	state.draw(performance.now(), true);
} // }}}
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

function next_kinetic(finish) { // {{{
	// The next button was clicked, or the screen was clicked, or the spacebar was pressed.
	// The finish parameter is true if the "forward to end" button was clicked.
	// Returns undefined.
	if (document.activeElement != document.body)
		document.activeElement.blur();
	if (state.show_question || state.waiting_threads.length == 0)
		return;
	if (finish) {
		while (state.sleeping_threads.length > 0)
			activate(state.sleeping_threads.splice(0, 1)[1], now, 0, true);
		while (!state.show_question && state.waiting_threads.length > 0)
			activate(state.waiting_threads.pop(), undefined, undefined, true);
	}
	else
		activate(state.waiting_threads.pop());
} // }}}

function prev_kinetic(full) { // {{{
	// The prev button was clicked, or backspace was pressed.
	var prev_music = state.music;
	if (full || prev_states.length < 2)
		prev_states.length = 1;
	else
		prev_states.pop();
	if (prev_states.length == 1) {
		question.style.display = 'none';
		state = new State();
		state.background = prev_states[0].background;
		state.music = prev_states[0].music;
		new_thread(prev_states[0].story, prev_states[0].cb, '');
	}
	else {
		state = new State(prev_states[prev_states.length - 1]);
		question.style.display = state.show_question ? 'block' : 'none';
	}
	state.draw();
	if (state.music != prev_music) {
		if (state.music === null) {
			music.pause();
			delete music.src;
		}
		else {
			music.src = state.music;
			music.play();
		}
	}
} // }}}

function keypress(event) { // {{{
	// Key press handler. If the key is space or backspace, do next or prev kinetic.
	// Returns undefined.
	//console.info(event);
	if (pending_music !== null) {
		music.src = pending_music;
		pending_music = null;
		music.play();
	}
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
