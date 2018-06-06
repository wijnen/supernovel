var server, error, login, group, content, program, current, responses, hidebox, hidelabel, shown, blocked;

function build_content() {
	// Don't update screen while content is visible.
	if (hidebox.checked)
		return;
	content.ClearAll();
	content.Add(hidebox);
	content.Add(hidelabel);
	var ans = 0;	// Number of participants that have answered.
	var anss = {};	// For each answer, number of times it is answered.
	var opts = [];	// List of answers that have been given.
	for (var i = 0; i < responses.length; ++i) {
		var a = responses[i][1];
		if (a !== null) {
			ans += 1;
			if (program[current].cmd != 'choices' && program[current].cmd != 'terms' && program[current].cmd != 'words') {
				a = [a];
			}
			for (var ia = 0; ia < a.length; ++ia) {
				if (anss[a[ia]] === undefined) {
					anss[a[ia]] = 0;
					opts.push(a[ia]);
				}
				anss[a[ia]] += 1;
			}
		}
	}
	opts.sort(function(a, b) { return anss[b] - anss[a]; });
	var vague = content.AddElement('div', 'vague');
	var clear = content.AddElement('div', 'clear');
	if (program[current]) {
		vague.AddElement('div').innerHTML = program[current].arg;
		if (program[current].cmd != 'title') {
			vague.AddElement('br');
			vague.AddElement('h1').AddText('Antwoorden gezien: ' + ans + ' / ' + responses.length);
		}
		var ol = clear.AddElement('ul');
		for (var i = 0; i < opts.length; ++i) {
			if (!blocked[opts[i]]) {
				var opt;
				if (program[current].cmd == 'choice' || program[current].cmd == 'choices')
					opt = program[current].option[opts[i]];
				else
					opt = opts[i];
				ol.AddElement('li').AddText(opt + ': ' + anss[opts[i]]);
			}
		}
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
		hidebox.checked = false;
		shown = true;
		build_content();
		shown = false;
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
		document.cookie = 'name=' + n;
		document.cookie = 'key=' + c;
	},
};

function init() {
	error = document.getElementById('error');
	login = document.getElementById('login');
	group = document.getElementById('group');
	content = document.getElementById('content');
	responses = [];
	blocked = {};
	server = Rpc(Connection, null, connection_lost);

	error.style.display = 'block';
	login.style.display = 'none';
	content.style.display = 'none';
	program = [];
	current = 0;
	hidebox = Create('input');
	hidebox.type = 'checkbox';
	hidebox.id = 'hidebox';
	hidelabel = Create('label');
	hidelabel.htmlFor = 'hidebox';
	hidelabel.AddText('Toon antwoorden');
	hidebox.AddEvent('change', build_content);
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
