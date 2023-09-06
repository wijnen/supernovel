"use strict";
// Globals. {{{

var screen_size = [1920, 1080];	// Size of the screen, in pixels. Defaults to [1920, 1080].
var all_sprites = {};	// All screen sprites.
var img_cache = {};	// Cache of loaded images; keys are tags, values are objects with mood keys and values of {url, size, hotspot, tag, mood}.
var audio_cache = {};	// Cache of loaded audio; keys are audioids, values are {url, duration, audioid}.
var screen_scale = 1;	// Scale for background and sprites.
var pending_music = null;	// Delay starting music because browsers don't allow it.
var elements; // DOM elements.

// Threads.
var state, prev_states;

// Flags.
var animating = false;	// Flag to disable animation handling when there is nothing to animate.
var reconnecting = false;	// Set to true when connection is closed (and reconnect is attempted), false when opened. Checked to avoid repeated failed reconnects.

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
		this.position = [0, 0, 0];
		this.position_hotspot = [0, 0];
		this.rotation = 0;
		this.rotation_hotspot = [0, 0];
		this.around = null;
		this.scale = [1, 1]
		this.scale_hotspot = [0, 0];
		this['with'] = null;
	}
	else {
		this.image = ref.image;
		if (ref.position === null)
			this.position = null;
		else
			this.position = this.copy_array(ref.position);
		this.position_hotspot = this.copy_array(ref.position_hotspot);
		this.rotation = ref.rotation
		this.rotation_hotspot = this.copy_array(ref.rotation_hotspot);
		this.around = this.copy_array(ref.around);
		this.scale = this.copy_array(ref.scale)
		this.scale_hotspot = this.copy_array(ref.scale_hotspot);
		this['with'] = ref['with'];
	}
	var mix_num = function(phase, a, b) {
		//console.info('mixing', a, b);
		if (b === null)
			return a;
		if (a === null)
			return b;
		if (typeof a == 'boolean')
			return b;
		if (typeof b == 'boolean')
			return a;
		//console.info('mixed', a + (b - a) * phase);
		return a + (b - a) * phase;
	};
	var mix_array = function(phase, a, b) {
		//console.error('mixing array', a, b);
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
		ret.rotation_hotspot = mix_array(phase, this.rotation_hotspot, to.rotation_hotspot);
		// Don't reuse previous around.
		ret.around = this.copy_array(to.around);
		ret.scale = mix_array(phase, this.scale, to.scale);
		ret.scale_hotspot = mix_array(phase, this.scale_hotspot, to.scale_hotspot);
		ret.image = to.image;
		//console.info('mixing position', this.position, to.position);
		if (to.position === null) {
			ret.position = this.copy_array(this.position);
			ret.position_hotspot = this.copy_array(this.position_hotspot);
		}
		else if (this.position === null) {
			ret.position = this.copy_array(to.position);
			ret.position_hotspot = this.copy_array(to.position_hotspot);
		}
		else {
			if (with_ == 'move') { // {{{
				if (ret.around === null) {
					// No rotation: simple interpolation.
					ret.position = mix_array(phase, this.position, to.position);
					ret.position_hotspot = mix_array(phase, this.position_hotspot, to.position_hotspot);
					//console.info('mixed position', ret.position);
				}
				else {
					var ratio = screen_size[1] / screen_size[0];
					// Rotate around some point. Compute starting and ending angles and radii; mix those.
					var from_point = mix_array(0, this.position, to.position);
					var to_point = mix_array(1, this.position, to.position);
					var from_vect = [from_point[0] - ret.around[0], (from_point[1] - ret.around[1]) / ratio];
					var to_vect = [to_point[0] - ret.around[0], (to_point[1] - ret.around[1]) / ratio];
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
					ret.position_hotspot = mix_array(phase, this.position_hotspot, to.position_hotspot);
					var x = ret.around[0] + radius * Math.cos(angle);
					var y = ret.around[1] + radius * Math.sin(angle) * ratio;
					var z = mix_num(phase, this.position[2], to.position[2]);
					ret.position = [x, y, z];
				}
			} // }}}
			else if (with_ == 'fade') { // {{{
				// TODO: handle fade.
				// - if phase <= 0 or phase >= 1: using only from or to values.
				// - otherwise, use both with appropriate transparency.
				// - do not mix values (other than transparency).
				// - clean up extra sprite when done with transform for any reason.
			} // }}}
			else {
				// TODO: handle non-linear interpolation ("with ...").
				ret.position = mix_array(1, this.position, to.position);
				ret.position_hotspot = mix_array(1, this.position_hotspot, to.position_hotspot);
			}
		}
		return ret;
	};
} // }}}

function select_ui(shown, other) { // {{{
	// Hide all elements except one (or two).
	var ui_elements = ['error', 'videodiv', 'contents', 'question', 'game'];
	var found_shown = false;
	var found_other = other === undefined;
	for (var e = 0; e < ui_elements.length; ++e) {
		if (ui_elements[e] == shown) {
			found_shown = true;
			elements[shown].style.display = '';
		}
		else if (ui_elements[e] == other) {
			found_other = true;
			elements[other].style.display = '';
		}
		else
			elements[ui_elements[e]].style.display = 'none';
	}
	if (!found_shown)
		console.error('Showing invalid element', shown);
	if (!found_other)
		console.error('Showing invalid element', other);
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
		if (this.start_time === null || this.duration === null) {
			ret = new SpriteState(this.from);
			ret.extra = null;
		}
		else {
			// Default animation type to 'move'.
			if (this['with'] === null)
				this['with'] = 'move';
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
		animate(true);
		return ret;
	};
} // }}}

function get_img(tag, mood, cb) { // {{{
	// Get an image from the cache, or load it if it wasn't in the cache yet.
	// Call cb when the image is loaded. Its argument is the image with attributes url (the data url), size (w, h), hotspot (x, y), tag and mood.
	// Returns undefined.
	//console.info('get img', tag, mood);
	if (tag === undefined)
		console.error('undefined image requested');
	if (mood === undefined)
		console.error('undefined mood requested');
	if (img_cache[tag] !== undefined && img_cache[tag][mood] !== undefined) {
		//console.info('getting image from cache', tag, mood);
		cb(img_cache[tag][mood]);
		return;
	}
	//console.info('getting image from server', tag, mood);
	server.call('get_sprite_image', [tag, mood], {}, function(image) {
		image.tag = tag;
		image.mood = mood;
		if (img_cache[tag] === undefined)
			img_cache[tag] = {};
		img_cache[tag][mood] = image;
		cb(image);
	});
} // }}}

function get_audio(audioid, cb) { // {{{
	// Get an audio data url from the cache, or load it if it wasn't in the cache yet.
	// Call cb when the file is loaded. Its argument is the image with attributes url (the data url), duration and audioid.
	// Returns undefined.
	if (audioid === undefined)
		console.error('undefined audio requested');
	if (audio_cache[audioid] !== undefined) {
		//console.info('getting audio from cache', audioid);
		cb(audio_cache[audioid]);
		return;
	}
	server.call('get_audio', [audioid], {}, function(audio) {
		//console.info('getting audio from server', audioid);
		if (audio === null) {
			cb(null);
			return;
		}
		audio.audioid = audioid;
		audio_cache[audioid] = audio;
		cb(audio);
	});
} // }}}

function DisplaySprite() { // {{{
	// Class that defines one sprite that is currently displayed.
	// Construct with new.
	var me = this;
	this.div = spritebox.AddElement('div', 'sprite');
	this.img = null;
	this.text = null;
	this.update = function(current_sprite, now) { // {{{
		// Update this sprite according to a state Sprite.
		this.cb = current_sprite.cb;
		var sprite_state = current_sprite.state(now);
		//console.info(current_sprite, sprite_state);
		if (sprite_state.position === null) {
			console.warn('active sprite has null position', current_sprite);
			return false;
		}
		me.div.style.zIndex = sprite_state.position[2];
		//console.info(sprite_state, sprite_state.image, sprite_state.position[0], sprite_state.position[1]);
		var set_position = function(img) {
			// Compute reference point, in image pixels ([0, 0] is hotspot, positive directions are towards top right).
			var reference = [];
			if (sprite_state.position_hotspot === null) {
				reference.push(0);
				reference.push(0);
			}
			else {
				for (var i = 0; i < 2; ++i) {
					var c = sprite_state.position_hotspot[i] || 0;
					// Position is based on sprite edge.
					if (c >= 0)
						reference.push(img.hotspot[i] + (img.size[i] - img.hotspot[i]) * c);
					else
						reference.push(img.hotspot[i] * (1 + c));
				}
			}
			var x = (sprite_state.position[0] + 1) / 2 * screen_size[0];
			var y = sprite_state.position[1] * screen_size[1];
			me.div.style.left = (x - reference[0] * sprite_state.scale[0]) * screen_scale + 'px';
			me.div.style.bottom = (y - reference[1] * sprite_state.scale[1]) * screen_scale + 'px';
			me.div.style.width = img.size[0] * screen_scale + 'px';
			me.div.style.height = img.size[1] * screen_scale + 'px';
			me.div.style.transformOrigin = img.hotspot[0] * screen_scale + 'px ' + (img.size[1] - img.hotspot[1] - 1) * screen_scale + 'px';
			me.div.style.transform = 'rotate(' + sprite_state.rotation * 360 + 'deg) scale(' + sprite_state.scale[0] + ',' + sprite_state.scale[1] + ')';
		};
		if (sprite_state.image.tag === null) {
			if (me.img !== null) {
				me.div.removeChild(me.img);
				me.img = null;
			}
			if (me.text === null)
				me.text = me.div.AddElement('span');
			me.text.ClearAll().AddText(sprite_state.image.mood);
			set_position({'size': [0, 0], 'hotspot': [0, 0]});	// FIXME: use actual size of text sprite.
		}
		else {
			get_img(sprite_state.image.tag, sprite_state.image.mood, function(img) { // {{{
				if (me.text !== null) {
					me.div.removeChild(me.text);
					me.text = null;
				}
				if (me.img === null)
					me.img = me.div.AddElement('img');
				if (img === null) {
					delete me.img.src;
					console.warn('image does not exist', sprite_state.image.tag, sprite_state.image.mood);
					return;
				}
				me.img.src = img.url;
				set_position(img);
			}); // }}}
		}
		return sprite_state.extra !== null;
	}; // }}}
	this.remove = function() {
		spritebox.removeChild(this.div);
	};
} // }}}

function State(ref) { // {{{
	// Class that holds an animation state. Construct with new. Main methods:
	// draw: update interface using this state.
	// constructor: create a copy for storing in history, or for restoring from history.
	this.thread = {};	// All running (and paused) threads.
	this.waiting_threads = [];	// Stack of threads that are currently waiting for next_kinetic. Usually length 0 or 1.
	this.sleeping_threads = [];	// Sorted list of threads that are in a wait instruction.
	this.show_question = false;	// Flag for next_kinetic to be disabled when a question is shown.
	this.background = (state && state.background ? state.background : '');
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
			this.background = '';
		elements.bg.src = this.background;
		if (this.background)
			elements.bg.RemoveClass('hidden');
		else
			elements.bg.AddClass('hidden');
		if (!skip_resize)
			resize();

		// Speech.
		if (this.speaker.name || this.speaker.text)
			elements.speechbox.style.display = 'block';
		else
			elements.speechbox.style.display = 'none';
		if (this.speaker.name) {
			elements.speaker.style.display = 'inline';
			speaker.innerHTML = this.speaker.name;
		}
		else
			elements.speaker.style.display = 'none';
		speech.innerHTML = this.speaker.text;
		if (this.speaker.image && this.speaker.image.url) {
			elements.speaker_image.style.display = 'block';
			speaker_image.src = this.speaker.image.url;
		}
		else
			elements.speaker_image.style.display = 'none';

		// Sprites.
		for (var s in all_sprites) {
			if (this.sprite[s] === undefined) {
				all_sprites[s].remove();
				delete all_sprites[s];
			}
		}
		var run_queue = [];
		for (var s in this.sprite) {
			if (all_sprites[s] === undefined)
				all_sprites[s] = new DisplaySprite();
			if (all_sprites[s].update(this.sprite[s], now)) {
				// Animation done; call cb.
				if (all_sprites[s].cb) {
					run_queue.push({target: all_sprites[s].cb, args: [now, all_sprites[s].extra], self: all_sprites[s]});
					all_sprites[s].cb = null;
				}
			}
		}

		// If any sleeper is ready, run it.
		while (this.sleeping_threads.length > 0 && this.sleeping_threads[0].when < now) {
			var w = this.sleeping_threads.splice(0, 1)[0];
			run_queue.push({target: activate, args: [w.thread, now, now - w.when, false], self: this});
		}
		if (this.sleeping_threads.length > 0)
			run_queue.push({target: animate, args: [true], self: this});
		for (var r = 0; r < run_queue.length; ++r) {
			run_queue[r].target.apply(run_queue[r].self, run_queue[r].args);
		}
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
	//console.info('running', name, state.thread);
	var current = state.thread[name];
	if (current === undefined) {
		console.info('not running thread because it does not exist:', name, state.thread)
		return;
	}
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
			if (current.cb) {
				var cb = current.cb;
				current.cb = null;
				cb(now - current.start);
			}
			state.draw(now);
			break;
		}
		current.pos += 1;
		//console.info('activating', name, 'action', action);
		if (action.action == 'speech') { // {{{
			state.waiting_threads.push(name);
			state.speaker.name = action.speaker;
			state.speaker.text = action.text;
			state.speaker.image = action.side;
			if (action.side !== null) {
				get_img(action.image, action.side, function(image) {
					// XXX use size and hotspot?
					elements.speaker_image.src = image.url;
				});
			}
			if (state.sprite[action.target] !== undefined && action.mood !== null) {
				get_img(action.image, action.mood, function(image) {
					var current_sprite = state.sprite[action.target];
					current_sprite.to.image = image;
					if (current_sprite.start_time + current_sprite.duration <= now)
						current_sprite.from.image = image;
				});
			}
			//console.info('pushing new prev state; waiting:', state.waiting_threads.length);
			prev_states.push(new State(state));
			state.draw(now);
			return;
		} // }}}
		else if (action.action == 'wait') { // {{{
			if (!fast_forward) {
				console.assert(typeof action.time == 'number', 'value of "time" must be a number');
				state.sleeping_threads.push({when: now + action.time * 1000, thread: name});
				state.sleeping_threads.sort();
				break;
			}
			// If fast forwarding, ignore wait instructions.
		} // }}}
		else if (action.action == 'music') { // {{{
			pending_music = null;
			state.music = action.target;
			if (action.target === null) {
				delete music.src;
				music.pause();
			}
			else {
				get_audio(action.target, function(audio) {
					if (audio === null) {
						delete music.src;
						music.pause();
					}
					else {
						music.src = audio.url;
						music.play();
					}
				});
			}
		} // }}}
		else if (action.action == 'sound') { // {{{
			if (action.target === null) {
				delete sound.src;
				sound.pause();
			}
			else {
				get_audio(action.target, function(audio) {
					if (audio === null) {
						delete sound.src;
						sound.pause();
					}
					else {
						sound.src = audio.url;
						sound.play();
					}
				});
			}
		} // }}}
		else if (action.action == 'font') { // {{{
			elements.speechbox.style.font = action.css;
		} // }}}
		else if (action.action == 'serial') { // {{{
			//console.info('running serial', action);
			new_thread(action.actions, function(extra) {
				//console.info('serial done; resuming', name);
				activate(name, now, extra, fast_forward);
			}, name + '+', now, fast_forward);
			return;
		} // }}}
		else if (action.action == 'parallel') { // {{{
			var wait = action.actions.length;
			for (var a = 0; a < action.actions.length; ++a) {
				//console.info('running parallel thread', name, a);
				new_thread([action.actions[a]], function(extra) {
					//console.info('finished one parallel component; waiting was', wait);
					if (--wait == 0) {
						//console.info('parallel done, resuming', name);
						activate(name, now, extra, fast_forward);
					}
				}, name + '+' + a, now, fast_forward)
			}
			return;
		} // }}}
		else if (action.action == 'scene') { // {{{
			//console.info('scene');
			// TODO: transitions.
			// Remove all sprites.
			for (var s in all_sprites)
				all_sprites[s].remove();
			all_sprites = [];
			// Set new background.
			if (action.image) {
				var mood = (action.mood === null ? '' : action.mood);
				get_img(action.image, action.mood, function(img) {
					state.background = img.url;
					resize();
					activate(name, now, 0, fast_forward);
				});
			}
			else {
				state.background = null;
				resize();
				activate(name, now, 0, fast_forward);
			}
			return;
		} // }}}
		else { // Move, hide. {{{
			var target = action.target;
			var mood;
			if (action.mood !== null) {
				//console.info('using specified mood', action.mood);
				mood = action.mood;
			}
			else {
				var sprite = state.sprite[action.target];
				if (sprite === undefined) {
					//console.info('New sprite without specified mood; using ""');
					mood = '';
				}
				else {
					//console.info('Existing sprite without specified mood; using existing mood');
					var phase = (now - sprite.start_time) / sprite.duration;
					var mixed = sprite.from.mix(phase, sprite.to, sprite['with']);
					//console.info('mix', mixed);
					mood = mixed.mood || '';
				}
			}
			get_img(action.image, mood, function(image) {
				var args = action.args;
				var current_sprite;
				if (action.action == 'hide') {
					if (fast_forward || args['in'] === null) {
						delete state.sprite[action.target];
						animate(true);
						activate(name, now);
						return;
					}
				}
				else {
					console.assert(action.action == 'move', 'invalid action "' + action.action + '"', action);
					if (state.sprite[action.target] !== undefined)
						current_sprite = state.sprite[action.target];
					else {
						current_sprite = new Sprite();
						state.sprite[action.target] = current_sprite;
						if (args.from === null) {
							current_sprite.from.position = args.to;
							current_sprite.from.position_hotspot = args.to_hotspot;
						}
					}
					if (args.from !== null) {
						current_sprite.from.position = args.from;
						current_sprite.from.position_hotspot = args.from_hotspot;
					}
					current_sprite.from.image = image;
				}
				current_sprite = state.sprite[action.target];
				current_sprite.to.position = args.to;
				current_sprite.to.position_hotspot = args.to_hotspot;
				current_sprite.to.image = image;
				current_sprite.to.scale = args.scale;
				current_sprite.to.scale_hotspot = args.scale_hotspot;
				current_sprite.to.rotation = args.rotation;
				current_sprite.to.rotation_hotspot = args.rotation_hotspot;
				current_sprite.to.around = args.around;
				if (!fast_forward && args['in'] !== null) {
					console.assert(typeof args['in'] == 'number', 'value of "in" must be a number');
					current_sprite.start_time = now;
					current_sprite['with'] = args['with'];
					current_sprite.duration = args['in'] * 1000;
					current_sprite.cb = function(now, extra) {
						if (action.action == 'hide')
							delete state.sprite[action.target];
						activate(name, now, extra, fast_forward);
					};
					animate(true);
					return;
				}
				else {
					if (args.to !== null) {
						current_sprite.from.position = args.to;
						current_sprite.from.position_hotspot = args.to_hotspot;
					}
					if (args.scale !== null)
						current_sprite.from.scale = args.scale;
					current_sprite.from.image = image;
					current_sprite.start_time = null;
					current_sprite['with'] = null;
				}
				//console.info('instant activation', name);
				activate(name, now);
			});
			// End function now; it will restart at callback.
			break;
		} // }}}
	}
	// If no thread is waiting for the user, nobody is talking and the speechbox should be hidden.
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
	select_ui('game');
	question.innerHTML = '';
	video.pause();
	if (state === undefined)
		state = new State();
	prev_states = [{story: story, cb: cb, background: state.background, music: state.music}];
	state.show_question = false;
	new_thread(story, cb, '');
	enable_menu_options(true);
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
// Menu {{{
function back() { // {{{
	prev_kinetic();
} // }}}

function rewind() { // {{{
	prev_kinetic(true);
} // }}}

function skip() { // {{{
	next_kinetic(true);
} // }}}

// Store options in variables, so they can be reliably translated, enabled and disabled.
var option_back = {text: '', action: back, enabled: false};
var option_rewind = {text: '', action: rewind, enabled: false};
var option_skip = {text: '', action: skip, enabled: false};

// Retranslate all strings, because language may have changed.
function update_strings() { // {{{
	option_back.text = _('Back');
	option_rewind.text = _('Rewind');
	option_skip.text = _('Skip');
	// XXX Translate other strings?
} // }}}

function enable_menu_options(enable) { // {{{
	option_back.enabled = enable;
	option_rewind.enabled = enable;
	option_skip.enabled = enable;
} // }}}

var menu = [ option_back, option_rewind, option_skip ];
// }}}

var Connection = { // {{{
	contents: function(data) {	// {{{ Update chapter and script contents.
		//console.info('contents', data);
		scripts.ClearAll();
		var buttons = [];
		for (var c = 0; c < data.length; ++c) {
			var script = data[c];
			buttons.push(scripts.AddElement('li').AddElement('button', 'script').AddText(script.join('/')).AddEvent('click', function() {
				server.call('start', [this.script]);
			}));
			buttons[c].script = script;
			buttons[c].type = 'button';
		}
	}, // }}}
	main: function(myname) {	// {{{ Show book and chapter selection.
		//console.info('main', myname);
		elements.bg.AddClass('hidden');
		select_ui('contents');
		video.pause();
		music.pause();
		sound.pause();
		pending_music = null;
		state = new State();
		state.background = null;
		enable_menu_options(false);
		resize();
		for (var s in all_sprites)
			all_sprites[s].remove();
		all_sprites = [];
		prev_states = [];
	}, // }}}
	kinetic: function(story, music) { // {{{ Run a story without a question; used for setting up current state on login.
		console.info('setup kinetic', music, story);
		server.lock();
		console.info('locked');
		pending_music = music;
		run_story(story, function() { console.info('unlock'); server.unlock(); });
	}, // }}}
	question: function(story, text, type, options) { // {{{ Run a story, followed by a question.
		console.info('question', text, type, story);
		run_story(story, function() {
			if (state.show_question)
				return;
			state.show_question = true;
			elements.speechbox.style.display = 'none';
			question.innerHTML = text;
			elements.question.style.display = 'block';
			// Clear speech so the old text cannot reappear by accident.
			elements.speaker.style.display = 'none';
			speech.innerHTML = '';
			var get_value;
			var button_text = _('Answer');
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
					button.AddText(_('Answer'));
					button.AddEvent('click', function() {
						for (var o = 0; o < choices.length; ++o) {
							if (choices[o].checked)
								break;
						}
						if (o < choices.length)
							server.call('answer', [[o + 1, l.value]]);
						else
							alert(_('Please select your answer'));
					});
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
							server.call('answer', [Number(this.value) + 1]);
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
			if (rich !== null)
				richinput(rich);
		});
	}, // }}}
	video: function(story, file) {	// {{{ Run a story, followed by a video.
		run_story(story, function() {
			music.pause();
			sound.pause();
			animate(false);
			video.src = file;
			video.load();
			select_ui('videodiv');
			speed(); // Set playback speed.
			video.play();
		});
	}, // }}}
}; // }}}

function restart() { // {{{
	elements.bg.AddClass('hidden');
	video.pause();
	music.pause();
	sound.pause();

	select_ui('error');
	elements.speaker.style.display = 'none';
} // }}}

function init() { // {{{
	// Initialize everything.
	// Returns undefined.

	// Fill global variables.
	elements = {};
	var varnames = ['error', 'videodiv', 'video', 'contents', 'scripts', 'question', 'speechbox', 'spritebox', 'speaker', 'speaker_image', 'speech', 'bg', 'game', 'music', 'sound'];
	for (var i = 0; i < varnames.length; ++i)
		elements[varnames[i]] = document.getElementById(varnames[i]);

	// Handle clicks on screen for progression.
	window.AddEvent('click', function(event) {
		if (state === undefined)
			return;
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
} // }}}

function opened() { // {{{
	reconnecting = false;
	if (elements === undefined)
		init();
	elements.bg.AddClass('hidden');
	select_ui('error');
	video.pause();
	music.pause();
	sound.pause();
} // }}}

function closed() { // {{{
	if (!reconnecting) {
		reconnecting = true;
		server.reconnect();
	}
	else
		alert('The connection with the server was lost; attempt to reconnect failed.');
} // }}}

function resize() { // {{{
	if (state === undefined)
		state = new State();
	screen_scale = Math.min(window.innerWidth / screen_size[0], window.innerHeight / screen_size[1]);
	elements.game.style.left = 'calc(50vw - ' + screen_size[0] * screen_scale / 2 + 'px)';
	elements.game.style.top = 'calc(50vh - ' + screen_size[1] * screen_scale / 2 + 'px)';
	elements.game.style.width = screen_size[0] * screen_scale + 'px';
	elements.game.style.height = screen_size[1] * screen_scale + 'px';
	state.draw(performance.now(), true);
} // }}}
window.AddEvent('resize', resize);
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
		while (state.sleeping_threads.length > 0) {
			//console.info('waking up for finish', state.sleeping_threads[0]);
			activate(state.sleeping_threads.splice(0, 1).thread, now, 0, true);
		}
		while (!state.show_question && state.waiting_threads.length > 0) {
			//console.info('waking up for finish', state.waiting_threads[state.waiting_threads.length - 1]);
			activate(state.waiting_threads.pop(), undefined, undefined, true);
		}
	}
	else {
		//console.info('waking up', state.waiting_threads[state.waiting_threads.length - 1]);
		activate(state.waiting_threads.pop());
	}
} // }}}

function prev_kinetic(full) { // {{{
	// The prev button was clicked, or backspace was pressed.
	var prev_music = state.music;
	if (full || prev_states.length < 2)
		prev_states.length = 1;
	else
		prev_states.pop();
	if (prev_states.length == 1) {
		elements.question.style.display = 'none';
		state = new State();
		state.background = prev_states[0].background;
		state.music = prev_states[0].music;
		new_thread(prev_states[0].story, prev_states[0].cb, '');
	}
	else {
		state = new State(prev_states[prev_states.length - 1]);
		elements.question.style.display = state.show_question ? 'block' : 'none';
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

// vim: set foldmethod=marker :
