var server, error, login, group, content, response, myname;

var Connection = {
	replaced: function() {
		alert('De verbinding is overgenomen door een nieuwe login');
		init();
	},
	login: function() {
		//console.info('login');
		error.style.display = 'none';
		login.style.display = 'block';
		content.style.display = 'none';
	},
	group: function(g) {
		group.ClearAll().AddText(g);
	},
	content: function(tag, data, my_response) {
		//console.info('content');
		error.style.display = 'none';
		login.style.display = 'none';
		content.style.display = 'block';
		document.getElementsByTagName('body')[0].style.background = (my_response === null ? '' : 'lightblue');
		response.ClearAll();
		if (my_response !== null) {
			if (data.cmd == 'choice')
				response.AddText(data.option[my_response]);
			else if (data.cmd == 'choices') {
				var r = [];
				for (var i = 0; i < my_response.length; ++i)
					r.push(data.option[my_response[i]]);
				response.AddText(r);
			}
			else
				response.AddText(my_response);
		}
		var response_cb;
		var div = content.ClearAll().AddElement('div');
		div.innerHTML = data.arg;
		var rich = false;
		if (data.cmd == 'choice') {
			var ul = div.AddElement('ul');
			var opts = [];
			for (var i = 0; i < data.option.length; ++i) {
				var l = ul.AddElement('li').AddElement('label');
				var input = l.AddElement('input');
				input.type = 'radio';
				opts.push(input);
				input.name = 'input';
				l.AddElement('span').innerHTML = data.option[i];
			}
			response_cb = function() {
				var r = [];
				for (var i = 0; i < opts.length; ++i)
					if (opts[i].checked)
						return i;
				return null;
			};
		}
		else if (data.cmd == 'choices') {
			var ul = div.AddElement('ul');
			var opts = [];
			for (var i = 0; i < data.option.length; ++i) {
				var l = ul.AddElement('li').AddElement('label');
				var input = l.AddElement('input');
				input.type = 'checkbox';
				opts.push(input);
				l.AddElement('span').innerHTML = data.option[i];
			}
			response_cb = function() {
				var r = [];
				for (var i = 0; i < opts.length; ++i) {
					if (opts[i].checked)
						r.push(i);
				}
				return r;
			};
		}
		else {
			rich = true;
			var div2 = content.AddElement('div');
			var e;
			if (data.cmd == 'term') {
				div2.AddText('Je antwoord: ');
				e = div2.AddElement('input', 'richinput');
				response_cb = function() {
					return e.value;
				};
			}
			if (data.cmd == 'word') {
				div2.AddText('Je antwoord (1 woord): ');
				e = div2.AddElement('input', 'richinput');
				response_cb = function() {
					return e.value;
				};
			}
			if (data.cmd == 'words') {
				div2.AddText('Je antwoord (1 of meer woorden): ');
				e = div2.AddElement('input', 'richinput');
				response_cb = function() {
					return e.value.split(' ');
				};
			}
			else if (data.cmd == 'terms') {
				div2.AddText('Je antwoorden (1 per regel): ');
				e = div2.AddElement('textarea', 'richinput');
				response_cb = function() {
					return e.value.split('\n');
				};
			}
			else if (data.cmd == 'title') {
				response_cb = function() { return null; };
				rich = false;
			}
		}
		if (data.cmd != 'title') {
			var button = content.AddElement('div').AddElement('button');
			button.type = 'button';
			button.AddText('Versturen');
			button.AddEvent('click', function() {
				var r = response_cb();
				server.call('respond', [tag, r]);
			});
		}
		if (rich)
			richinput(content);
		content.Add(response);
	},
	cookie: function(n, c) {
		document.cookie = 'name=' + encodeURIComponent(n);
		document.cookie = 'key=' + encodeURIComponent(c);
	},
};

function init() {
	error = document.getElementById('error');
	login = document.getElementById('login');
	group = document.getElementById('group');
	content = document.getElementById('content');
	response = Create('div', 'response');
	server = Rpc(Connection, null, connection_lost);

	error.style.display = 'block';
	login.style.display = 'none';
	content.style.display = 'none';
}
window.AddEvent('load', init);

function connection_lost() {
	try {
		error.style.display = 'block';
		login.style.display = 'none';
		content.style.display = 'none';
		server = Rpc(Connection, null, connection_lost);
	}
	catch (err) {
	}
}

function log_in() {
	var loginname = document.getElementById('loginname').value;
	var password = document.getElementById('password').value;
	server.call('login', [loginname, password], {}, function(error) {
		if (error)
			alert('Inloggen is mislukt: ' + error);
	});
	return false;
}

// vim: set foldmethod=marker foldmarker={,} :
