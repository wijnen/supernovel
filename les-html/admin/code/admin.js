var server, error, login, group, content, names, program, current, responses, blocked;

function build_content() {
	var ul = content.ClearAll().AddElement('ul');
	for (var i = 0; i < program.length; ++i) {
		var li = ul.AddElement('li');
		var button = li.AddElement('button');
		button.innerHTML = program[i]['arg'];
		button.type = 'button';
		if (i == current) {
			li.AddClass('active');
			button.disabled = true;
		}
		else {
			button.AddEvent('click', function() {
				server.call('run', [this.index]);
			});
			button.index = i;
		}
	}
	var ans = 0;
	var anss = {};
	var opts = [];
	var students = {};
	var waiting = '', offline = '';
	for (var i = 0; i < responses.length; ++i) {
		var a = responses[i][1];
		if (a !== null) {
			ans += 1;
			if (anss[a] === undefined) {
				anss[a] = 0;
				students[a] = responses[i][0];
				opts.push(a);
			}
			else {
				students[a] += ', ' + responses[i][0];
			}
			anss[a] += 1;
		}
		else {
			if (responses[i][2]) {
				if (waiting.length > 0)
					waiting += ', ';
				waiting += responses[i][0];
			}
			else {
				if (offline.length > 0)
					offline += ', ';
				offline += responses[i][0];
			}
		}
	}
	opts.sort(function(a, b) { return anss[b] - anss[a]; });
	ul = names.ClearAll().AddElement('ul');
	for (var i = 0; i < opts.length; ++i) {
		var li = ul.AddElement('li');
		var box = li.AddElement('input');
		li.AddText('(' + anss[opts[i]] + ') ' + opts[i] + ':' + students[opts[i]]);
		box.type = 'checkbox';
		box.checked = (blocked[opts[i]] != true);
		box.opt = opts[i];
		box.AddEvent('change', function() {
			server.call('block', [this.opt, !this.checked]);
		});
	}
	ul.AddElement('li').AddText('Wacht op: ' + waiting);
	ul.AddElement('li').AddText('Offline: ' + offline);
}

var Connection = {
	replaced: function() {
		alert('De verbinding is overgenomen door een nieuwe login');
		init();
	},
	login: function() {
		error.style.display = 'none';
		login.style.display = 'block';
		content.style.display = 'none';
		names.style.display = 'none';
	},
	group: function(g) {
		group.AddText(g);
	},
	program: function(prog) {
		error.style.display = 'none';
		login.style.display = 'none';
		content.style.display = 'block';
		names.style.display = 'block';
		program = prog;
		build_content();
	},
	current: function(cur) {
		current = cur;
		build_content();
	},
	responses: function(res) {
		responses = res;
		build_content();
	},
	blocked: function(b) {
		blocked = b;
		build_content();
	},
};

function init() {
	error = document.getElementById('error');
	login = document.getElementById('login');
	group = document.getElementById('group');
	content = document.getElementById('content');
	names = document.getElementById('names');
	responses = [];
	blocked = {};
	server = Rpc(Connection, null, connection_lost);

	error.style.display = 'block';
	login.style.display = 'none';
	content.style.display = 'none';
	names.style.display = 'none';
}
window.AddEvent('load', init);

function connection_lost() {
	try {
		alert('De verbinding met de server is verbroken.');
		error.style.display = 'block';
		login.style.display = 'none';
		content.style.display = 'none';
		names.style.display = 'none';
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
