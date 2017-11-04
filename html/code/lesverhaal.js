var login, videodiv, video, contents, question;
var server_obj, server;

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
		video.pause();
		for (var s in question.style)
			delete question.style[s];
	},
	style: function(key, value) {
		question.style[key] = value;
	},
	question: function(type, q, options) {
		question.style.display = 'block';
		videodiv.style.display = 'none';
		contents.style.display = 'none';
		video.pause();
		question.ClearAll().innerHTML = q;
		var get_value;
		var button_text = 'Antwoord';
		switch (type) {
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
			case 'short': // <input>
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
	},
	video: function(file) {
		video.src = file;
		video.load();
		videodiv.style.display = 'block';
		contents.style.display = 'none';
		question.style.display = 'none';
		speed(); // Set playback speed.
		video.play();
	},
};

function video_done() {
	video.pause();
	server.video_done();
}

function init() {
	login = document.getElementById('login');
	videodiv = document.getElementById('video');
	video = document.getElementsByTagName('video')[0];
	contents = document.getElementById('contents');
	question = document.getElementById('question');
	server_obj = Rpc(Connection, null, connection_lost);
	server = server_obj.proxy;

	login.style.display = 'none';
	videodiv.style.display = 'none';
	contents.style.display = 'none';
	question.style.display = 'none';
}
window.AddEvent('load', init);

function connection_lost() {
	alert('De verbinding met de server is verbroken.');
}

function log_in() {
	var name = document.getElementById('name').value;
	var group = document.getElementById('class').value;
	var password = document.getElementById('password').value;
	server.login(name, group, password);
	return false;
}

function speed() {
	var factor = Number(document.getElementById('speed').value) / 100;
	if (factor > 0)
		video.playbackRate = factor;
}
