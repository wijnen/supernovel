var server, error, login, group, content, response;

var Connection = {
	replaced: function() {
		alert('De verbinding is overgenomen door een nieuwe login');
		init();
	},
	login: function() {
		error.style.display = 'none';
		login.style.display = 'block';
		content.style.display = 'none';
	},
	group: function(g) {
		group.AddText(g);
	},
	content: function(tag, data, my_response) {
		error.style.display = 'none';
		login.style.display = 'none';
		content.style.display = 'block';
		document.getElementsByTagName('body')[0].style.background = (my_response === null ? '' : 'lightblue');
		response.ClearAll();
		if (my_response !== null)
			response.AddText(my_response);
		var cmd = data['cmd'];
		var arg = data['arg'];
		var response_cb;
		var div = content.ClearAll().AddElement('div');
		if (cmd == 'Choice') {
			var ul = div.AddElement('ul');
			var opts = [];
			for (var i = 0; i < data.length; ++i) {
				var l = ul.AddElement('li').AddElement('label');
				var input = l.AddElement('input');
				input.type = 'radio';
				opts.push(input);
				input.name = 'input';
				l.AddElement('span').innerHTML = data[i];
			}
			response_cb = function() {
				var r = [];
				for (var i = 0; i < opts.length; ++i)
					if (opts[i].checked)
						return i;
				return null;
			};
		}
		else if (cmd == 'Choices') {
			var ul = div.AddElement('ul');
			var opts = [];
			for (var i = 0; i < data.length; ++i) {
				var l = ul.AddElement('li').AddElement('label');
				var input = l.AddElement('input');
				input.type = 'checkbox';
				opts.push(input);
				l.AddElement('span').innerHTML = data[i];
			}
			response_cb = function() {
				var r = [];
				for (var i = 0; i < opts.length; ++i)
					r.push(opts[i].checked);
				return r;
			};
		}
		else {
			div.innerHTML = arg;
			var div2 = content.AddElement('div');
			var e;
			if (cmd == 'Term') {
				e = div2.AddElement('input');
				response_cb = function() {
					return e.value;
				};
			}
			else if (cmd == 'Terms') {
				e = div2.AddElement('textarea');
				response_cb = function() {
					return e.value;
				};
			}
			else if (cmd == 'Title') {
				response_cb = function() { return null; };
			}
		}
		if (cmd != 'Title') {
			var button = content.AddElement('div').AddElement('button');
			button.type = 'button';
			button.AddText('Versturen');
			button.AddEvent('click', function() {
				var r = response_cb();
				server.call('respond', [tag, r]);
			});
		}
		content.Add(response);
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
		alert('De verbinding met de server is verbroken.');
		error.style.display = 'block';
		login.style.display = 'none';
		content.style.display = 'none';
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
