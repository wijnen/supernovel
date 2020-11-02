var server;
var content;
var error;

var Connection = {
	refresh: function(data) {
		var cmd = data[0];
		var shown = data[1];
		var answers, opts, num, total;
		if (shown) {
			answers = data[2];
			opts = data[3];
		}
		else {
			num = data[2];
			total = data[3];
		}
		content.innerHTML = cmd.arg;
		if (cmd.cmd != 'title') {
			content.AddElement('br');
			if (shown) {
				var ol = content.AddElement('ul');
				for (var i = 0; i < opts.length; ++i) {
					var opt;
					if (cmd.cmd == 'choice' || cmd.cmd == 'choices')
						opt = cmd.option[opts[i]];
					else
						opt = opts[i];
					ol.AddElement('li').AddText(opt + ': ' + answers[opts[i]]);
				}
			}
			else {
				content.AddElement('h1').AddText('Antwoorden gezien: ' + num + ' / ' + total);
			}
		}
	},
};

window.AddEvent('load', function () {
	content = document.getElementById('content');
	error = document.getElementById('error');
	server = Rpc(Connection, connection_made, connection_lost);
});

function connection_made() {
	error.style.display = 'none';
}

function connection_lost() {
	try {
		server = Rpc(Connection, null, connection_lost);
	}
	catch (err) {
		error.style.display = '';
	}
}

// vim: set foldmethod=marker foldmarker={,} :
