var server, error, login, content, groups, group, chapter, current_chapter, program, current, responses, blocked;

function reset_password(user) {
	if (!confirm('Do you want to reset the password for ' + responses[user].name + '?'))
		return;
	server.call('reset_password', [user]);
}

function build_content() {
	// Build group selection.
	var list = document.getElementById('students');
	list.ClearAll();
	if (groups !== undefined) {
		for (var g = 0; g < groups.length; ++g) {
			var li = list.AddElement('li');
			var label = li.AddElement('label');
			var input = label.AddElement('input');
			label.AddText(groups[g]);
			input.type = 'radio';
			input.name = 'group';
			input.idx = g;
			input.checked = groups[g] == group;
			input.AddEvent('click', function(event) {
				event.preventDefault();
				server.call('group', [this.idx]);
			});
		}
	}
	// Build chapter selection.
	var list = document.getElementById('chapters');
	list.ClearAll();
	if (chapter !== undefined) {
		for (var c = 0; c < chapter.length; ++c) {
			var li = list.AddElement('li');
			var label = li.AddElement('label');
			var input = li.AddElement('input');
			label.AddText(chapter[c]);
			input.type = 'radio';
			input.name = 'chapter';
			input.idx = c;
			input.checked = c == current_chapter;
			input.AddEvent('click', function(event) {
				event.preventDefault();
				server.call('chapter', [this.idx]);
			});
		}
	}
	// Build question selection.
	var table = document.getElementById('questions');
	table.ClearAll();
	if (program !== undefined) {
		for (var p = 0; p < program.length; ++p) {
			var tr = table.AddElement('tr');
			if (p & 1)
				tr.AddClass('odd');
			var input = tr.AddElement('td').AddElement('input');
			input.type = 'radio';
			input.idx = p;
			input.checked = p == current;
			input.AddEvent('click', function() {
				event.preventDefault();
				server.call('run', [this.idx]);
			});
			input.id = 'q' + p;
			input.name = 'question';
			var label = tr.AddElement('td').AddElement('label');
			label.htmlFor = input.id;
			label.innerHTML = program[p].arg;
			var td = tr.AddElement('td');
			if (p > 0) {
				var button = td.AddElement('button').AddText('↑').AddEvent('click', function() {
					server.call('q_move_up', [this.idx]);
				});
				button.idx = p;
			}
			if (p < program.length - 1) {
				button = td.AddElement('button').AddText('↓').AddEvent('click', function() {
					server.call('q_move_down', [this.idx]);
				});
				button.idx = p;
			}
			button = td.AddElement('button').AddText('❌').AddEvent('click', function() {
				server.call('q_remove', [this.idx]);
			});
			button.idx = p;
			button = td.AddElement('button').AddText('✏').AddEvent('click', function() {
				if (this.editing) {
					server.call('edit', [this.idx, this.box.value]);
				}
				else {
					this.box = this.label.ClearAll().AddElement('textarea');
					this.box.value = program[this.idx].markdown;
					this.editing = true;
				}
			});
			button.idx = p;
			button.label = label;
			button.editing = false;
		}
	}
	// Build response section.
	var table = document.getElementById('results');
	table.ClearAll();
	var tr = table.AddElement('tr');
	tr.AddElement('th').AddText('Name');
	tr.AddElement('th').AddText('State');
	tr.AddElement('th').AddText('Use');
	tr.AddElement('th').AddText('Answer');
	if (responses !== undefined) {
		for (var r = 0; r < responses.length; ++r) {
			tr = table.AddElement('tr');
			tr.AddElement('td').AddText(responses[r].name);
			if (responses[r].state == 'offline' || responses[r].state == 'disconnected') {
				var button = tr.AddElement('td').AddElement('button').AddText(responses[r].state);
				button.idx = r;
				button.type = 'button';
				button.AddEvent('click', function() {
					reset_password(this.idx);
				});
			}
			else
				tr.AddElement('td').AddText(responses[r].state);
			var use = tr.AddElement('td').AddElement('input');
			use.type = 'checkbox';
			use.checked = !responses[r].blocked;
			use.idx = r;
			use.AddEvent('change', function() {
				console.info(responses[this.idx], this.checked);
			});
			tr.AddElement('td').AddText(responses[r].answer);
		}
	}
}

var closed = false;
var Connection = {
	replaced: function() {
		closed = true;
		alert('De verbinding is overgenomen door een nieuwe login');
	},
	closed: function() {
		closed = true;
		alert('De verbinding is verbroken door de docent');
	},
	login: function() {
		error.style.display = 'none';
		login.style.display = 'block';
		content.style.display = 'none';
	},
	program: function(ch_list, ch, prog) {
		error.style.display = 'none';
		login.style.display = 'none';
		content.style.display = 'block';
		chapter = ch_list;
		current_chapter = ch;
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
	responses: function(g_list, g, res) {
		groups = g_list;
		group = g;
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
	content = document.getElementById('content');
	responses = [];
	blocked = {};
	error.style.display = 'block';
	login.style.display = 'none';
	content.style.display = 'none';
	server = Rpc(Connection, null, connection_lost);
}
window.AddEvent('load', init);

function connection_lost() {
	if (closed)
		return;
	closed = true;
	alert('The connection was closed.')
	error.style.display = 'block';
	login.style.display = 'none';
	content.style.display = 'none';
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

function store_answers() {
	server.call('store_answers');
}

function new_group() {
	var name = document.getElementById('newgname').value;
	if (name == '') {
		alert("Please enter the new group's name");
		return;
	}
	server.call('new_group', name);
}

function new_student() {
	var name = document.getElementById('newsname').value;
	if (name == '') {
		alert("Please enter the new student's name");
		return;
	}
	server.call('new_student', name);
}

function new_question() {
	server.call('new_question');
}

// vim: set foldmethod=marker foldmarker={,} :
