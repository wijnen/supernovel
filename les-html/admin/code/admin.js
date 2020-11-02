var server, error, login, group, content, names, program, current, responses, blocked;

function build_content() {
	var ul = content.ClearAll().AddElement('ul');
	for (var i = 0; i < program.length; ++i) {
		var li = ul.AddElement('li');
		var button = li.AddElement('button');
		button.innerHTML = program[i].arg;
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
	var waiting = '';
	var disconnected = [];
	var offline = [];
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
			if (responses[i][2] == 'waiting') {
				if (waiting.length > 0)
					waiting += ', ';
				waiting += responses[i][0];
			}
			else if (responses[i][2] == 'disconnected') {
				disconnected.push([responses[i][0], responses[i][2]]);
			}
			else {
				offline.push([responses[i][0], responses[i][2]]);
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
	var parts = [['Disconnected', disconnected], ['Offline', offline]];
	for (var i = 0; i < parts.length; ++i) {
		parts[i][1].sort();
		var li = ul.AddElement('li').AddText(parts[i][0] + ': ');
		for (var u = 0; u < parts[i][1].length; ++u) {
			if (u > 0)
				li.AddText(', ');
			var a = li.AddElement('a');
			a.AddText(parts[i][1][u][0]);
			if (parts[i][1][u][1] != 'inactive')
				a.href = 'javascript:reset_password("' + parts[i][1][u][0] + '")';
		}
	}
}

function reset_password(user) {
	if (!confirm('Do you want to reset the password for ' + user + '?'))
		return;
	server.call('reset_password', [user]);
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
		group.ClearAll().AddText(g);
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
		document.getElementById('show').checked = false;
		show();
		build_content();
	},
	show: function(show) {
		document.getElementById('show').checked = show;
		build_content();
	},
	freeze: function(freeze) {
		document.getElementById('freeze').checked = freeze;
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
		error.style.display = 'block';
		login.style.display = 'none';
		content.style.display = 'none';
		names.style.display = 'none';
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

function show() {
	var state = document.getElementById('show').checked;
	server.call('show_answers', [state], {}, function() {
		if (!state) {
			document.getElementById('freeze').checked = false;
		}
		document.getElementById('freeze').disabled = state == false;
	});
}

function freeze() {
	var state = document.getElementById('freeze').checked;
	server.call('freeze', [state]);
}

// vim: set foldmethod=marker foldmarker={,} :
