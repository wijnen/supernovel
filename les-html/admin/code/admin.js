var server, error, login, group, content, program, current;

function build_content() {
	var ul = content.ClearAll().AddElement('ul');
	for (var i = 0; i < program.length; ++i) {
		var li = ul.AddElement('li');
		var button = li.AddElement('button', 'floater');
		button.AddText('Run');
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
		li.AddElement('div').innerHTML = program[i]['arg'];
	}
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
	},
	group: function(g) {
		group.AddText(g);
	},
	program: function(prog) {
		error.style.display = 'none';
		login.style.display = 'none';
		content.style.display = 'block';
		program = prog;
		build_content();
	},
	current: function(cur) {
		current = cur;
		build_content();
	},
	responses: function(responses) {
		// These are only used by the beamer.
	},
};

function init() {
	error = document.getElementById('error');
	login = document.getElementById('login');
	group = document.getElementById('group');
	content = document.getElementById('content');
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
