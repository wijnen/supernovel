var server, error, login, group, content, program, current, responses, hidebox, hidelabel, shown;

function build_content() {
	// Don't update screen while content is visible.
	if (hidebox.checked)
		return;
	content.ClearAll();
	content.Add(hidebox);
	content.Add(hidelabel);
	var ans = 0;
	var anss = {};
	var opts = [];
	for (var i = 0; i < responses.length; ++i) {
		var a = responses[i][1];
		if (a !== null) {
			ans += 1;
			if (anss[a] === undefined) {
				anss[a] = 0;
				opts.push(a);
			}
			anss[a] += 1;
		}
	}
	opts.sort(function(a, b) { return anss[b] - anss[a]; });
	var vague = content.AddElement('div', 'vague');
	var clear = content.AddElement('div', 'clear');
	vague.AddElement('h1').AddText('Antwoorden gezien: ' + ans + ' / ' + responses.length);
	var ol = clear.AddElement('ul');
	for (var i = 0; i < opts.length; ++i)
		ol.AddElement('li').AddText(opts[i] + ': ' + anss[opts[i]]);
	if (ans > 0 && ans == responses.length && !shown) {
		hidebox.checked = true;
		shown = true;
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
	program = [];
	current = 0;
	responses = [];
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
